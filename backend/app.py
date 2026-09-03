"""B.E.R.N.D. Backend - FastAPI entrypoint for Vercel Services.

Exports `app` for Vercel to run directly. No `.listen()` call here.

All heavy imports (langchain, chromadb, sentence-transformers) are deferred
until the first request that actually needs them. This keeps the cold-start
import footprint tiny and avoids Vercel build issues.
"""

import os
import json
import uuid
import asyncio
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

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

# -- FastAPI app ---------------------------------------------------------------
app = FastAPI(title="B.E.R.N.D. Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -- Lazy RAG module loading ---------------------------------------------------
# We defer importing rag.py until the first request that needs it.
# This avoids importing chromadb, sentence-transformers, etc. at module level.
_rag_module = None

def _get_rag():
    global _rag_module
    if _rag_module is None:
        print("[APP] Loading RAG module (first time)...")
        from src import rag
        _rag_module = rag
        print("[APP] RAG module loaded.")
    return _rag_module


# -- Health & config checks ----------------------------------------------------
@app.get("/")
async def root():
    return {"status": "ok", "service": "bernd-backend"}


@app.get("/config")
async def config():
    """Return current LLM provider config (safe - no API keys exposed)."""
    rag = _get_rag()
    return {
        "llm_provider": rag.LLM_PROVIDER,
        "llm_model": rag.LLM_MODEL,
        "rag_ready": True,
    }


# -- Ticket endpoint (no auth required anymore) --------------------------------
@app.post("/chat/auth/ticket", response_model=TicketResponse)
async def auth_ticket():
    """Return a short-lived ticket for WebSocket connection."""
    ticket = str(uuid.uuid4())
    return TicketResponse(ticket=ticket)


# -- File upload endpoint ------------------------------------------------------
@app.post("/files/upload")
async def upload_file(file: UploadFile = File(...)):
    """Accept PDF, Excel, PowerPoint, Word, text, and images."""
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
        rag = _get_rag()
        chunk_count = rag.ingest_documents(docs)
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
    """Main WebSocket endpoint for real-time chat."""
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
                        response = WSConversation(
                            conversation_id=cid,
                            messages=[],
                        )
                else:
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

                if not cid:
                    cid = store.create_conversation()

                conv = store.get_conversation(cid)
                if not conv:
                    cid = store.create_conversation()
                    conv = store.get_conversation(cid)

                store.add_message(cid, "user", user_text)

                history = [
                    {"role": m.role, "content": m.content}
                    for m in conv.messages[:-1]
                ][-10:]

                try:
                    print(f"[WS] Generating answer for conv={cid}...")
                    rag = _get_rag()
                    answer = await asyncio.wait_for(
                        asyncio.to_thread(rag._generate_answer_sync, user_text, history),
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

                ts = datetime.utcnow().isoformat()
                store.add_message(cid, "assistant", answer)

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