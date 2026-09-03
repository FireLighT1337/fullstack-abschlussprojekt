"""Pydantic models for request / response validation."""

from typing import List, Optional
from pydantic import BaseModel


# -- HTTP models ---------------------------------------------------------------

class TicketResponse(BaseModel):
    ticket: str


class UploadSuccessResponse(BaseModel):
    type: str = "success"
    additionalInformation: dict


# -- WebSocket inbound models --------------------------------------------------

class WSGetConversationList(BaseModel):
    type: str


class WSGetConversation(BaseModel):
    type: str
    conversation_id: Optional[str] = None


class WSMessage(BaseModel):
    type: str
    conversation_id: Optional[str] = None
    message: str


class WSDeleteConversation(BaseModel):
    type: str
    conversation_id: str


# -- WebSocket outbound models -------------------------------------------------

class WSConversationListItem(BaseModel):
    conversation_id: str


class WSConversationList(BaseModel):
    type: str = "conversationList"
    conversation_list: List[WSConversationListItem]


class WSConversationMessage(BaseModel):
    role: str
    message: str
    timestamp: str


class WSConversation(BaseModel):
    type: str = "conversation"
    conversation_id: str
    messages: List[WSConversationMessage]


class WSBotMessage(BaseModel):
    type: str = "message"
    conversation_id: str
    message: str
    timestamp: str


class WSSuccess(BaseModel):
    type: str = "success"
    additionalInformation: dict


class WSError(BaseModel):
    type: str = "error"
    error: str