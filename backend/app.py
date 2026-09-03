"""B.E.R.N.D. Backend - FastAPI entrypoint for Vercel Services.

Exports `app` for Vercel to run directly. No `.listen()` call here.
"""

import os
import json
import uuid
import asyncio
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src import store
from src.models import (
    TicketResponse,
    UploadSuccessResponse,
    WSConversationList,
    WSConversationListItem,
    WSConversation,
    WSConversationMessage,
    WSBotMessage,
    WSSuccess,
    WSError,
)
from src.documents import save_upload, detect_mime_from_name, load_documents
from src.rag import ingest_documents, _generate_answer_sync, LLM_PROVIDER, LLM_MODEL


# -- FastAPI app ---------------------------------------------------------------
app = FastAPI(title="B.E.R.N.D. Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -- Health & config checks ----------------------------------------------------
@app.get("/")
async def root():
    return {"status": "ok", "service": "bernd-backend"}


@app.get("/config")
async def config():
    """Return current LLM provider config (safe - no API keys exposed)."""
    return {
        "llm_provider": LLM_PROVIDER,
        "llm_model": LLM_MODEL,
        "rag_ready": True,
    }


# -- Ticket endpoint (no auth required anymore) --------------------------------
@app.post("/chat/auth/ticket", response_model=TicketResponse)
async def auth_ticket():
    """Return a short-lived ticket for WebSocket connection.
    
    The frontend still calls this endpoint and sends the ticket as a WS
    query param. We accept any ticket since Azure AD has been removed.
    """
    ticket = str(uuid.uuid4())
    return TicketResponse(ticket=ticket)


# -- File upload endpoint ------------------------------------------------------
@app.post("/files/upload")
async def upload_file(file: UploadFile = File(...)):
    """Accept PDF, Excel, PowerPoint, Word, text, and images.
    
    Extracts text from supported documents and adds them to the RAG vector store.
    Images are saved but not processed for text in this MVP.
    """
    MAX_SIZE_MB = 50
    MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

    contents = await file.read()
    if len(contents) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_SIZE_MB} MB.")

    # Save to disk
    saved_path = save_upload(file.filename or "upload", contents)
    mime = detect_mime_from_name(file.filename or "")

    # Extract text and ingest into RAG (skip images)
    docs = load_documents(saved_path, mime)
    if docs:
        chunk_count = ingest_documents(docs)
        print(f"[RAG] Ingested {chunk_count} chunks from {file.filename}")
    else:
        print(f"[RAG] No text extracted from {file.filename} (type: {mime})")

    store.register_upload(
        filename=file.filename or "upload",
        path=str(saved_path),
        file_type=mime,
    )

    return UploadSuccessResponse(
        additionalInformation={"filename": file.filename or "upload"}
    )


# -- WebSocket endpoint --------------------------------------------------------
@app.websocket("/chat")
async def websocket_chat(websocket: WebSocket, ticket: Optional[str] = None):
    """Main WebSocket endpoint for real-time chat.
    
    Message types from client:
      - GetConversationList
      - GetConversation      (conversation_id may be null)
      - message              (conversation_id may be null)
      - DeleteConversation
    """
    await websocket.accept()
    print(f"[WS] Client connected (ticket={ticket})")

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json(
                    WSError(error="Invalid JSON").model_dump()
                )
                continue

            msg_type = msg.get("type")

            # -- GetConversationList -------------------------------------------
            if msg_type == "GetConversationList":
                conversations = store.get_all_conversations()
                response = WSConversationList(
                    conversation_list=[
                        WSConversationListItem(conversation_id=c.id)
                        for c in conversations
                    ]
                )
                await websocket.send_json(response.model_dump())

            # -- GetConversation ---------------------------------------------
            elif msg_type == "GetConversation":
                cid = msg.get("conversation_id")
                if cid:
                    conv = store.get_conversation(cid)
                    if conv:
                        response = WSConversation(
                            conversation_id=conv.id,
                            messages=[
                                WSConversationMessage(
                                    role=m.role,
                                    message=m.content,
                                    timestamp=m.timestamp,
                                )
                                for m in conv.messages
                            ],
                        )
                    else:
                        # Conversation not found - return empty
                        response = WSConversation(
                            conversation_id=cid,
                            messages=[],
                        )
                else:
                    # New/local conversation - return empty
                    response = WSConversation(
                        conversation_id="",
                        messages=[],
                    )
                await websocket.send_json(response.model_dump())

            # -- message (user sends chat message) ---------------------------
            elif msg_type == "message":
                cid = msg.get("conversation_id")
                user_text = msg.get("message", "").strip()

                if not user_text:
                    await websocket.send_json(
                        WSError(error="Empty message").model_dump()
                    )
                    continue

                # Create new conversation if cid is null / missing
                if not cid:
                    cid = store.create_conversation()

                conv = store.get_conversation(cid)
                if not conv:
                    # Should not happen after create, but guard anyway
                    cid = store.create_conversation()
                    conv = store.get_conversation(cid)

                # Store user message
                store.add_message(cid, "user", user_text)

                # Build history for RAG (last 10 messages)
                history = [
                    {"role": m.role, "content": m.content}
                    for m in conv.messages[:-1]
                ][-10:]

                # Generate assistant response via RAG
                try:
                    print(f"[WS] Generating answer for conv={cid}...")
                    answer = await asyncio.wait_for(
                        asyncio.to_thread(_generate_answer_sync, user_text, history),
                        timeout=60.0,
                    )
                    print(f"[WS] Answer generated ({len(answer)} chars).")
                except asyncio.TimeoutError:
                    print("[WS] RAG generation timed out.")
                    answer = (
                        "Entschuldigung, die Antwort hat zu lange gedauert. "
                        "Bitte versuchen Sie es noch einmal."
                    )
                except RuntimeError as e:
                    print(f"[RAG Config Error] {e}")
                    answer = (
                        f"Entschuldigung, der LLM-Provider ist nicht konfiguriert. "
                        f"Fehler: {str(e)}"
                    )
                except Exception as e:
                    print(f"[RAG Error] {type(e).__name__}: {e}")
                    answer = (
                        "Entschuldigung, ich konnte keine Antwort generieren. "
                        "Bitte versuchen Sie es spater noch einmal."
                    )

                # Store assistant message
                ts = datetime.utcnow().isoformat()
                store.add_message(cid, "assistant", answer)

                # Send bot reply to client
                response = WSBotMessage(
                    conversation_id=cid,
                    message=answer,
                    timestamp=ts,
                )
                await websocket.send_json(response.model_dump())

            # -- DeleteConversation ------------------------------------------
            elif msg_type == "DeleteConversation":
                cid = msg.get("conversation_id")
                if cid:
                    deleted = store.delete_conversation(cid)
                    if deleted:
                        await websocket.send_json(
                            WSSuccess(
                                additionalInformation={
                                    "action": "DeleteConversation",
                                    "conversation_id": cid,
                                }
                            ).model_dump()
                        )
                    else:
                        await websocket.send_json(
                            WSError(error="Conversation not found").model_dump()
                        )
                else:
                    await websocket.send_json(
                        WSError(error="Missing conversation_id").model_dump()
                    )

            # -- Unknown type --------------------------------------------------
            else:
                await websocket.send_json(
                    WSError(error=f"Unknown message type: {msg_type}").model_dump()
                )

    except WebSocketDisconnect:
        print("[WS] Client disconnected")
    except Exception as e:
        print(f"[WS] Error: {e}")
        try:
            await websocket.close()
        except Exception:
            pass