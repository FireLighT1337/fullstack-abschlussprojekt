"""RAG engine: document ingestion + retrieval + generation.

Supports multiple LLM providers (no OpenAI subscription required):
  - Groq        (free tier, 1M tokens/day, OpenAI-compatible)
  - Google Gemini (free tier, 1,500 req/day)
  - Ollama      (local, dev only - does NOT work on Vercel)

Embeddings use HuggingFace (free, local, no API key).

Environment variables:
  LLM_PROVIDER=groq|gemini|ollama    (default: groq)
  GROQ_API_KEY=gsk_...              (required if provider=groq)
  GEMINI_API_KEY=...                (required if provider=gemini)
  LLM_MODEL=...                     (optional, provider-specific defaults)
"""

import os
from typing import List, Optional

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from . import store


# -- Configuration -------------------------------------------------------------
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "groq").lower()

# Default models per provider
_DEFAULT_MODELS = {
    "groq": "openai/gpt-oss-20b",
    "gemini": "gemini-1.5-flash",
    "ollama": "llama3.1",
}

LLM_MODEL = os.environ.get("LLM_MODEL") or _DEFAULT_MODELS.get(LLM_PROVIDER, "openai/gpt-oss-20b")


# -- Global RAG state ----------------------------------------------------------
_vectorstore: Optional[Chroma] = None
_embeddings: Optional[HuggingFaceEmbeddings] = None
_llm = None


def _get_embeddings() -> HuggingFaceEmbeddings:
    """Free, local HuggingFace embeddings. No API key needed."""
    global _embeddings
    if _embeddings is None:
        # all-MiniLM-L6-v2 is small (~80MB), fast, and good quality
        _embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
    return _embeddings


def _get_llm():
    """Lazy-load the LLM based on LLM_PROVIDER env var."""
    global _llm
    if _llm is not None:
        return _llm

    if LLM_PROVIDER == "groq":
        from langchain_groq import ChatGroq
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY environment variable is not set. "
                "Get a free key at https://console.groq.com/keys"
            )
        _llm = ChatGroq(
            groq_api_key=api_key,
            model_name=LLM_MODEL,
            temperature=0.3,
            max_retries=2,
        )

    else:
        raise RuntimeError(f"Unknown LLM_PROVIDER: {LLM_PROVIDER}. Use: groq, gemini, or ollama.")

    return _llm


def _get_vectorstore() -> Chroma:
    global _vectorstore
    if _vectorstore is None:
        _vectorstore = Chroma(
            embedding_function=_get_embeddings(),
            collection_name="bernd_kb",
        )
    return _vectorstore


def ingest_documents(docs: List[Document]) -> int:
    """Split and embed documents into the vector store. Returns chunk count."""
    if not docs:
        return 0

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
    )
    chunks = text_splitter.split_documents(docs)

    if not chunks:
        return 0

    vs = _get_vectorstore()
    vs.add_documents(chunks)
    return len(chunks)


def has_documents() -> bool:
    """True if the vector store contains any documents."""
    vs = _get_vectorstore()
    try:
        return vs._collection.count() > 0
    except Exception:
        return False


def _generate_answer_sync(question: str, history: List[dict]) -> str:
    """Synchronous RAG generation. Must be called in a thread pool."""
    llm = _get_llm()

    # Build conversation history string
    history_lines = []
    for h in history:
        role = "User" if h.get("role") == "user" else "Assistant"
        history_lines.append(f"{role}: {h.get('content', '')}")
    history_text = "\n".join(history_lines[-10:])

    print(f"[RAG] has_documents={has_documents()}, history_len={len(history)}")

    if has_documents():
        print("[RAG] Retrieving relevant chunks...")
        vs = _get_vectorstore()
        retriever = vs.as_retriever(search_kwargs={"k": 5})
        retrieved_docs = retriever.invoke(question)
        print(f"[RAG] Retrieved {len(retrieved_docs)} chunks.")
        context = "\n\n".join([doc.page_content for doc in retrieved_docs])

        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are B.E.R.N.D., a helpful AI assistant. Use the provided context to answer. If you don't know, say so. Be concise and helpful."),
            ("human", """Conversation history:
{history}

Retrieved context:
{context}

Question: {question}
Answer:"""),
        ])

        print("[RAG] Calling LLM...")
        chain = prompt | llm | StrOutputParser()
        answer = chain.invoke({
            "history": history_text,
            "context": context,
            "question": question,
        })
        print(f"[RAG] LLM responded ({len(answer)} chars).")
        return answer

    else:
        # No documents yet - plain LLM with history
        print("[RAG] No documents, using plain LLM...")
        from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

        messages = [SystemMessage(content="You are B.E.R.N.D., a helpful AI assistant. Answer concisely and helpfully.")]
        for h in history:
            if h.get("role") == "user":
                messages.append(HumanMessage(content=h.get("content", "")))
            else:
                messages.append(AIMessage(content=h.get("content", "")))
        messages.append(HumanMessage(content=question))

        response = llm.invoke(messages)
        print(f"[RAG] LLM responded ({len(response.content)} chars).")
        return response.content