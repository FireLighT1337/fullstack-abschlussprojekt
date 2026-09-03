"""In-memory stores for conversations and uploaded documents.

On Vercel Services the backend runs as a long-running process, so in-memory
storage survives across requests within the same deployment. Data is lost on
redeploy / restart - swap this out for Redis / Postgres when you need persistence.
"""

from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, field
import uuid


@dataclass
class Message:
    role: str          # "user" or "assistant"
    content: str
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class Conversation:
    id: str
    messages: List[Message] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())


# -- Conversation store --------------------------------------------------------
_conversations: Dict[str, Conversation] = {}


def create_conversation() -> str:
    cid = str(uuid.uuid4())
    _conversations[cid] = Conversation(id=cid)
    return cid


def get_conversation(cid: str) -> Optional[Conversation]:
    return _conversations.get(cid)


def get_all_conversations() -> List[Conversation]:
    # newest first
    return sorted(_conversations.values(), key=lambda c: c.created_at, reverse=True)


def add_message(cid: str, role: str, content: str) -> Optional[Message]:
    conv = _conversations.get(cid)
    if not conv:
        return None
    msg = Message(role=role, content=content)
    conv.messages.append(msg)
    return msg


def delete_conversation(cid: str) -> bool:
    return _conversations.pop(cid, None) is not None


# -- Document / RAG store ------------------------------------------------------
# Holds references to uploaded files (path + metadata).
_uploaded_files: List[dict] = []


def register_upload(filename: str, path: str, file_type: str) -> dict:
    entry = {
        "filename": filename,
        "path": path,
        "type": file_type,
        "uploaded_at": datetime.utcnow().isoformat(),
    }
    _uploaded_files.append(entry)
    return entry


def get_uploaded_files() -> List[dict]:
    return list(_uploaded_files)