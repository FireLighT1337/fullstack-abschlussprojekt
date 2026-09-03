"""RAG engine: document ingestion + retrieval + generation.

Supports multiple LLM providers (no OpenAI subscription required):
  - Groq        (free tier, 1M tokens/day, OpenAI-compatible)
  - Google Gemini (free tier, 1,500 req/day)
  - Ollama      (local, dev only - does NOT work on Vercel)

Embeddings use the HuggingFace Inference API (free tier, remote —
no local torch/sentence-transformers, keeps the Vercel bundle small).

Environment variables:
  LLM_PROVIDER=groq|gemini|ollama    (default: groq)
  GROQ_API_KEY=gsk_...              (required if provider=groq)
  GEMINI_API_KEY=...                (required if provider=gemini)
  LLM_MODEL=...                     (optional, provider-specific defaults)
  HF_TOKEN=hf_...                   (required - HuggingFace Inference API token)
"""

import os
from typing import List, Optional

from langchain_chroma import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from . import store


# -- Configuration -------------------------------------------------------------
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "groq").lower()

_DEFAULT_MODELS = {
    "groq": "openai/gpt-oss-20b",
    "gemini": "gemini-1.5-flash",
    "ollama": "llama3.1",
}

LLM_MODEL = os.environ.get("LLM_MODEL") or _DEFAULT_MODELS.get(LLM_PROVIDER, "openai/gpt-oss-20b")

EMBEDDING_MODEL = os.environ.get(
    "EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
)


# -- Global RAG state ----------------------------------------------------------
_vectorstore: Optional[Chroma] = None
_embeddings = None
_llm = None


def _get_embeddings():
    """Remote HuggingFace Inference API embeddings. No local torch needed."""
    global _embeddings
    if _embeddings is None:
        from langchain_community.embeddings import HuggingFaceInferenceAPIEmbeddings

        hf_token = os.environ.get("HF_TOKEN")
        if not hf_token:
            raise RuntimeError(
                "HF_TOKEN environment variable is not set. "
                "Get a free token at https://huggingface.co/settings/tokens"
            )
        _embeddings = HuggingFaceInferenceAPIEmbeddings(
            api_key=hf_token,
            model_name=EMBEDDING_MODEL,
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