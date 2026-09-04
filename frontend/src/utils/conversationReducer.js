import { toIdString, isLocalId, makeLocalId } from "./chatUtils";

function collectUsedConversationNums(list) {
  const used = new Set();
  for (const c of list || []) {
    if (Number.isFinite(c.conversationNum) && c.conversationNum > 0) {
      used.add(c.conversationNum);
    }
  }
  return used;
}

function smallestMissingPositive(used) {
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

function assignNumbersAndTitles(prevList, incomingList) {
  const prevById = new Map(prevList.map((c) => [c.id, c]));

  const prevByRealId = new Map();
  for (const c of prevList) {
    if (!isLocalId(c.id)) {
      prevByRealId.set(c.id, c);
    }
  }

  const combined = incomingList.map((item) => {
    const prev = prevById.get(item.id);
    const prevReal = prevByRealId.get(item.id);

    return {
      id: item.id,
      conversationNum:
        prev?.conversationNum ?? prevReal?.conversationNum ?? null,
      title: prev?.title ?? prevReal?.title ?? null,
      messages: prev?.messages ?? prevReal?.messages ?? [],
      state: prev?.state ?? prevReal?.state ?? "ready",
    };
  });

  const used = collectUsedConversationNums(combined);

  return combined.map((c) => {
    if (c.conversationNum == null) {
      const n = smallestMissingPositive(used);
      used.add(n);
      return { ...c, conversationNum: n, title: `Konversation ${n}` };
    }
    return c;
  });
}

export const initialConversationState = {
  list: [],
  activeId: null,
};

export function conversationReducer(state, action) {
  switch (action.type) {
    case "INIT_LIST": {
      const items = (action.list || []).map((item) => ({
        id: String(item.conversation_id),
      }));

      const merged = assignNumbersAndTitles(state.list, items);

      return {
        ...state,
        list: merged,
      };
    }

    case "SWITCH": {
      const nextId = toIdString(action.id);
      const exists = state.list.some((c) => c.id === nextId);

      // If switching to a new local conversation, create it immediately with title/number
      if (!exists && isLocalId(nextId)) {
        const used = collectUsedConversationNums(state.list);
        const n = smallestMissingPositive(used);
        const newConv = {
          id: nextId,
          state: "local",
          messages: [],
          title: `Konversation ${n}`,
          conversationNum: n,
        };
        return { ...state, activeId: nextId, list: [...state.list, newConv] };
      }

      return {
        ...state,
        activeId: nextId,
        list: state.list.map((c) =>
          c.id === nextId
            ? { ...c, state: c.state === "local" ? "local" : "loading" }
            : c,
        ),
      };
    }

    case "LOAD_SUCCESS": {
      const realId = toIdString(action.id);
      const incoming = Array.isArray(action.messages) ? action.messages : [];

      // If we are in a local conversation and server sends history for a different ID, ignore
      if (isLocalId(state.activeId) && realId !== state.activeId) {
        return state;
      }

      // Local ID becomes a real ID after server creates a new conversation
      if (
        state.activeId &&
        isLocalId(state.activeId) &&
        realId &&
        !isLocalId(realId)
      ) {
        return {
          ...state,
          activeId: realId,
          list: state.list.map((c) =>
            c.id === state.activeId
              ? {
                  ...c,
                  id: realId,
                  state: "ready",
                  messages: incoming.length === 0 ? c.messages : incoming,
                }
              : c,
          ),
        };
      }

      // Normal merge (existing server conversation)
      return {
        ...state,
        list: state.list.map((c) =>
          c.id === realId
            ? {
                ...c,
                state: "ready",
                messages: incoming.length === 0 ? c.messages : incoming,
              }
            : c,
        ),
      };
    }

    case "APPEND_USER": {
      const targetId = toIdString(action.id);
      if (!targetId || !state.list.some((c) => c.id === targetId)) {
        const localId = targetId || makeLocalId();
        const used = collectUsedConversationNums(state.list);
        const n = smallestMissingPositive(used);

        return {
          ...state,
          activeId: localId,
          list: [
            ...state.list,
            {
              id: localId,
              state: "local",
              messages: [action.message],
              title: `Konversation ${n}`,
              conversationNum: n,
            },
          ],
        };
      }
      return {
        ...state,
        list: state.list.map((c) =>
          c.id === targetId
            ? { ...c, messages: [...(c.messages || []), action.message] }
            : c,
        ),
      };
    }

    case "APPEND_ASSISTANT": {
      const realId = toIdString(action.id);
      if (
        state.activeId &&
        isLocalId(state.activeId) &&
        realId &&
        !isLocalId(realId)
      ) {
        return {
          ...state,
          activeId: realId,
          list: state.list.map((c) =>
            c.id === state.activeId
              ? {
                  ...c,
                  id: realId,
                  state: "ready",
                  messages: [...(c.messages || []), action.message],
                }
              : c,
          ),
        };
      }

      return {
        ...state,
        list: state.list.map((c) =>
          c.id === realId
            ? {
                ...c,
                messages: [...(c.messages || []), action.message],
                state: "ready",
              }
            : c,
        ),
      };
    }

    case "DELETE_START": {
      return {
        ...state,
        list: state.list.map((c) =>
          c.id === action.id ? { ...c, state: "deleting" } : c,
        ),
      };
    }

    case "DELETE_SUCCESS": {
      const removedId = toIdString(action.id);
      const cleaned = state.list.filter((c) => c.id !== removedId);

      const removedIdx = state.list.findIndex((c) => c.id === removedId);
      let nextActive = state.activeId;
      if (state.activeId === removedId) {
        nextActive = cleaned[removedIdx - 1]?.id ?? cleaned[0]?.id ?? null;
      }

      return { ...state, list: cleaned, activeId: nextActive };
    }

    default:
      return state;
  }
}
