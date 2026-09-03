import { useEffect, useReducer, useRef, useState } from "react";
import { toast } from "react-toastify";
import { getAccessToken } from "../managers/auth/msal";
import {
  initialConversationState,
  conversationReducer,
} from "./conversationReducer";

import {
  switchConversationAction,
  initListAction,
  loadSuccessAction,
  appendUserAction,
  appendAssistantAction,
  deleteStartAction,
  deleteSuccessAction,
} from "./conversationActions";

import {
  toUiMessage,
  toIdString,
  makeLocalId,
  toOutboundId,
  wsUrlFromTicket,
  isLocalId,
} from "./chatUtils";

// Safely parse JSON; return null if parsing fails
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// Extract an error message from JSON or fall back to status text
function errorMsgFrom(res, json, fallback = "Fehler") {
  return (
    json?.error ||
    json?.message ||
    json?.detail ||
    res.statusText ||
    `${fallback} (HTTP ${res.status})`
  );
}

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

export default function useChatData() {
  const [state, dispatch] = useReducer(
    conversationReducer,
    initialConversationState,
  );

  // Always keep a ref to the latest state for WS handlers
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const lastRequestedConversationIdRef = useRef(null);
  const stateRef = useRef(state);

  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isBotThinking, setIsBotThinking] = useState(false);

  const activeId = state.activeId;
  const activeConversation = state.list.find((c) => c.id === activeId) || null;

  // DEBUG: log state changes
  useEffect(() => {
    console.log("[DEBUG] State updated:", {
      activeId: state.activeId,
      listCount: state.list.length,
      conversationIds: state.list.map((c) => c.id),
      activeMessages: activeConversation?.messages?.length ?? 0,
    });
  }, [state, activeConversation]);

  const safeSend = (obj) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(JSON.stringify(obj));
      return true;
    } catch {
      return false;
    }
  };

  /* Bootstrap : WS Connect + GET List */
  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      try {
        setLoading(true);

        const token = await getAccessToken();
        const res = await fetch(`${API_BASE}/chat/auth/ticket`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ticket) {
          toast.error("Ticket konnte nicht geladen werden.");
          setLoading(false);
          reconnectTimerRef.current = setTimeout(connect, 8000);
          return;
        }

        if (cancelled) return;

        const ws = new WebSocket(wsUrlFromTicket(json.ticket));
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("[DEBUG] WebSocket opened");
          setConnected(true);
          setLoading(false);

          safeSend({ type: "GetConversationList" });
        };

        ws.onclose = () => {
          console.log("[DEBUG] WebSocket closed");
          setConnected(false);
          !cancelled && (reconnectTimerRef.current = setTimeout(connect, 5000));
        };

        ws.onerror = () => {
          console.error("[DEBUG] WebSocket error");
          toast.error("WebSocket Fehler");
          ws.close();
        };

        ws.onmessage = (evt) => {
          console.log("[DEBUG] WS raw message:", evt.data);
          const msg = JSON.parse(evt.data);
          console.log("[DEBUG] WS parsed message:", msg);

          switch (msg.type) {
            case "conversationList": {
              const list = msg.conversation_list || [];
              console.log("[DEBUG] conversationList:", list);
              dispatch(initListAction(list));
              break;
            }

            case "conversation": {
              const realId =
                toIdString(msg.conversation_id) ||
                toIdString(lastRequestedConversationIdRef.current);
              const srvMessages = Array.isArray(msg.messages)
                ? msg.messages
                : [];
              const ui = srvMessages.map((m) =>
                toUiMessage(
                  m.role,
                  m.message ?? m.content ?? m.text,
                  m.timestamp,
                ),
              );

              console.log(
                "[DEBUG] conversation loaded:",
                realId,
                "messages:",
                ui.length,
              );
              dispatch(loadSuccessAction(realId, ui));
              break;
            }

            case "message": {
              const realId = toIdString(msg.conversation_id);
              const uiMsg = toUiMessage(
                "assistant",
                msg.message,
                msg.timestamp,
              );
              console.log("[DEBUG] assistant message received:", {
                realId,
                uiMsg,
                currentActiveId: stateRef.current.activeId,
              });
              dispatch(appendAssistantAction(realId, uiMsg));
              setIsBotThinking(false);
              break;
            }

            case "success": {
              const info = msg?.additionalInformation || {};
              if (
                info.action === "DeleteConversation" &&
                info.conversation_id != null
              ) {
                dispatch(deleteSuccessAction(info.conversation_id));
                toast.success("Konversation wurde gelöscht.");
                break;
              } else {
                // Fallback: remove the first conversation currently in "deleting" state
                const s = stateRef.current;
                const deletingConv = s.list.find((c) => c.state === "deleting");
                if (deletingConv) {
                  dispatch(deleteSuccessAction(deletingConv.id));
                  toast.success("Konversation wurde gelöscht.");
                }
              }
              break;
            }

            case "error": {
              console.error("[DEBUG] Server error:", msg.error);
              toast.error(msg.error || "Serverfehler");
              break;
            }

            default:
              console.log("[DEBUG] Unknown message type:", msg.type);
              break;
          }
        };
      } catch (e) {
        console.error("[DEBUG] Connection failed:", e);
        toast.error("Verbindung fehlgeschlagen.");
        setLoading(false);
        reconnectTimerRef.current = setTimeout(connect, 8000);
      }
    };

    connect();
    return () => {
      cancelled = true;
      wsRef.current?.close();
      clearTimeout(reconnectTimerRef.current);
    };
  }, []);

  const switchConversation = (id) => {
    const nextId = toIdString(id);
    dispatch(switchConversationAction(nextId));

    // ALWAYS request from server
    safeSend({
      type: "GetConversation",
      conversation_id: toOutboundId(nextId),
    });
    lastRequestedConversationIdRef.current = nextId;
  };

  const addConversation = () => {
    const localId = makeLocalId();
    dispatch(switchConversationAction(localId));
  };

  const handleSend = (text) => {
    const messageText = text.trim();
    if (!messageText) {
      toast.error("Bitte Nachricht eingeben.");
      return;
    }

    const active = state.activeId;
    console.log("[DEBUG] handleSend, activeId:", active);

    // create message
    const userMsg = toUiMessage("user", messageText, new Date().toISOString());
    dispatch(appendUserAction(active, userMsg));
    setIsBotThinking(true);

    // send to server
    const outboundId = toOutboundId(active);
    console.log("[DEBUG] Sending to server:", {
      type: "message",
      conversation_id: outboundId,
      message: messageText,
    });
    safeSend({
      type: "message",
      conversation_id: outboundId,
      message: messageText,
    });
  };

  const MAX_FILE_SIZE_MB = 50;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  const handleUpload = async (files) => {
    const file = files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(
        `Die Datei ist zu groß. Maximal erlaubt: ${MAX_FILE_SIZE_MB} MB.`,
        { toastId: "upload_too_large" },
      );
      return;
    }

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/files/upload`, {
        method: "POST",
        body: form,
        credentials: "include", // if auth needs cookies
      });
      const json = await safeJson(res);

      if (res.status === 413) {
        toast.error(
          `Die Datei ist zu groß. Maximal erlaubt: ${MAX_FILE_SIZE_MB} MB.`,
          { toastId: "upload_too_large" },
        );
        return;
      }

      if (!res.ok) {
        const msg = errorMsgFrom(res, json, "Upload fehlgeschlagen");
        toast.error(msg, { toastId: "upload_error" });
        return;
      }

      if (!json) {
        toast.error("Upload fehlgeschlagen: Ungültige Serverantwort.", {
          toastId: "upload_error",
        });
        return;
      }

      if (json?.type === "success") {
        const info = json?.additionalInformation ?? {};
        const filename = info.filename ?? json?.filename ?? file.name;
        toast.success(`Datei hochgeladen: ${filename}`);
      } else {
        const msg = errorMsgFrom(res, json, "Upload fehlgeschlagen");
        toast.error(msg, { toastId: "upload_error" });
      }
    } catch (e) {
      console.error("Upload error:", e);
      toast.error("Upload fehlgeschlagen", { toastId: "upload_error" });
    }
  };

  const deleteConversation = (id) => {
    // If it's a local-only conversation (not yet on server), just remove from state
    if (isLocalId(id)) {
      dispatch(deleteSuccessAction(id));
      return;
    }

    dispatch(deleteStartAction(id));

    safeSend({
      type: "DeleteConversation",
      conversation_id: toOutboundId(id),
    });
  };
  return {
    conversations: state.list,
    activeConversation,
    activeConversationId: state.activeId,
    isBotThinking,
    connected,
    loading,

    addConversation,
    switchConversation,
    deleteConversation,
    handleSend,
    handleUpload,
  };
}
