# B.E.R.N.D. | Full-Stack Chatbot

A React-based web frontend + FastAPI backend for **B.E.R.N.D.**, an AI-powered chatbot backed by a RAG (Retrieval-Augmented Generation) service. The app connects to the backend over WebSockets and is deployed as a unified full-stack app on **Vercel**.

---

## ✨ Features

- ⚡ **Real-time chat** over WebSockets with automatic reconnection
- 💬 **Multiple conversations** — create, switch between, and delete chat sessions
- 📎 **File uploads** — send documents directly into the RAG knowledge base (PDF, Excel, PowerPoint, Word, JPG; max 5 MB)
- 📝 **Markdown rendering** with syntax highlighting in bot responses
- 🔔 **Toast notifications** for connection status, errors, and upload confirmations
- ☁️ **CI/CD** via Git push → Vercel auto-deploy

---

## 🗂️ Project Structure

```
repo-root/
├── vercel.json              # Vercel Services routing config
├── chatbot/                 # React frontend
│   ├── public/              # Static assets (index.html, favicon, manifest)
│   └── src/
│       ├── App.js           # Root component, layout
│       ├── components/
│       │   ├── Message/         # Single chat message bubble
│       │   ├── MessageInput/    # Text input + upload button
│       │   ├── MessageList/     # Scrollable message history
│       │   ├── Sidebar/         # Conversation list + new/delete actions
│       │   └── SiteHeader/      # Top bar with user info and menu toggle
│       ├── managers/
│       │   └── auth/
│       │       └── msal.js      # Dummy auth (no login required)
│       └── utils/
│           ├── useChatData.js        # Main hook: WS lifecycle, send, upload, conversations
│           ├── useMsalUser.js        # Hook: static guest user
│           ├── conversationReducer.js # State management for conversation list
│           ├── conversationActions.js # Action creators
│           └── chatUtils.js          # ID helpers, timestamp formatting, WS URL builder
│
└── backend/                 # FastAPI backend
    ├── app.py               # FastAPI entrypoint (exports `app`)
    ├── requirements.txt     # Python dependencies
    ├── SETUP_GUIDE.md       # Detailed backend setup instructions
    └── src/
        ├── store.py           # In-memory conversation & file storage
        ├── models.py          # Pydantic request/response models
        ├── documents.py       # File loading (PDF, Excel, PPT, Word, text)
        └── rag.py             # LangChain RAG pipeline (Groq + HuggingFace)
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- Python 3.10+
- A free [Groq](https://console.groq.com/keys) API key (for LLM inference)

### 1. Clone & Install

```bash
git clone https://github.com/FireLighT1337/abschlussprojekt.git
cd abschlussprojekt
```

**Frontend:**

```bash
cd chatbot
npm install
```

**Backend:**

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Environment Variables

**Backend** (`backend/.env`):

```env
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_your_key_here
LLM_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

**Frontend** (`chatbot/.env.local`):

```env
REACT_APP_API_BASE=http://localhost:8000
REACT_APP_WS_PATH=/chat
```

### 3. Run Locally

**Backend:**

```bash
cd backend
export GROQ_API_KEY=gsk_...
uvicorn app:app --reload --port 8000
```

**Frontend:**

```bash
cd chatbot
npm start
# Opens on http://localhost:3000
```

---

## 🔌 Backend Architecture

### HTTP REST Endpoints

| Endpoint            | Method | Description                                            |
| ------------------- | ------ | ------------------------------------------------------ |
| `/`                 | GET    | Health check                                           |
| `/config`           | GET    | Current LLM provider & model info                      |
| `/chat/auth/ticket` | POST   | Get short-lived ticket for WebSocket connection        |
| `/files/upload`     | POST   | Upload a document (PDF, Excel, PPT, Word, text, image) |

### WebSocket at `/chat?ticket=...`

| Direction | Type                  | Description                                               |
| --------- | --------------------- | --------------------------------------------------------- |
| → Server  | `GetConversationList` | Fetch all conversations                                   |
| → Server  | `GetConversation`     | Load messages for a conversation (id can be `null`)       |
| → Server  | `message`             | Send a user message (id can be `null` → creates new conv) |
| → Server  | `DeleteConversation`  | Delete a conversation                                     |
| ← Client  | `conversationList`    | List of all conversations                                 |
| ← Client  | `conversation`        | Messages for a single conversation                        |
| ← Client  | `message`             | Bot reply                                                 |
| ← Client  | `success`             | Confirmation (e.g. delete)                                |
| ← Client  | `error`               | Error from server                                         |

### RAG Pipeline

1. **Upload** a document → text is extracted → split into chunks → embedded with HuggingFace `all-MiniLM-L6-v2` → stored in ChromaDB
2. **Ask a question** → retrieve top-5 relevant chunks via similarity search → feed into LLM prompt with conversation history → generate answer
3. **No documents?** Falls back to plain LLM chat (no retrieval)

### LLM Providers

| Provider      | Free Tier         | Default Model                               | Best For         |
| ------------- | ----------------- | ------------------------------------------- | ---------------- |
| **Groq**      | 1M tokens/day     | `meta-llama/llama-4-scout-17b-16e-instruct` | Speed, daily use |
| Google Gemini | 1,500 req/day     | `gemini-1.5-flash`                          | Google ecosystem |
| Ollama        | Unlimited (local) | `llama3.1`                                  | Local dev only   |

Set via `LLM_PROVIDER` env var. Groq is recommended — get a free key at [console.groq.com/keys](https://console.groq.com/keys).

**Embeddings** use HuggingFace `all-MiniLM-L6-v2` — completely free, runs locally on CPU, ~80MB download on first use.

---

## 📁 Supported Upload Types

| Format     | Extensions                                      |
| ---------- | ----------------------------------------------- |
| PDF        | `.pdf`                                          |
| Excel      | `.xls`, `.xlsx`                                 |
| PowerPoint | `.ppt`, `.pptx`                                 |
| Word       | `.doc`, `.docx`                                 |
| Text       | `.txt`, `.md`, `.csv`, `.json`                  |
| Image      | `.jpg`, `.jpeg` (saved, not processed for text) |

Maximum file size: **50 MB**

---

## 🧪 Running Tests

```bash
cd chatbot
npm test
```

Tests use [React Testing Library](https://testing-library.com/) and [MSW](https://mswjs.io/) for API mocking. Test files are colocated with their components (`.test.jsx`).

---

## ☁️ Deployment

The app is deployed to **Vercel** as a unified full-stack project using **Vercel Services**.

### Vercel Services Architecture

A single Vercel project contains both the React frontend and the FastAPI backend, deployed under **one shared domain**. A root-level `vercel.json` routes requests:

```json
{
  "services": {
    "frontend": {
      "root": "chatbot",
      "framework": "create-react-app",
      "outputDirectory": "build"
    },
    "backend": {
      "root": "backend",
      "framework": "fastapi",
      "entrypoint": "app.py"
    }
  },
  "rewrites": [
    {
      "source": "/chat/(.*)?",
      "destination": { "type": "service", "service": "backend" }
    },
    {
      "source": "/files/(.*)?",
      "destination": { "type": "service", "service": "backend" }
    },
    {
      "source": "/(.*)",
      "destination": { "type": "service", "service": "frontend" }
    }
  ]
}
```

### Environment Variables (Vercel Dashboard)

**Backend:**
| Variable | Description |
|----------|-------------|
| `LLM_PROVIDER` | `groq` |
| `GROQ_API_KEY` | Your Groq API key |
| `LLM_MODEL` | `meta-llama/llama-4-scout-17b-16e-instruct` |

**Frontend:**
| Variable | Description |
|----------|-------------|
| `REACT_APP_API_BASE` | Production URL, e.g. `https://your-project.vercel.app` |
| `REACT_APP_WS_PATH` | `/chat` |

> **Note:** You won't know the final `*.vercel.app` URL until after the first deploy. Deploy once, note the URL, set `REACT_APP_API_BASE`, then redeploy.

### Deploy Steps

1. Push code to GitHub
2. Import into Vercel
3. Set environment variables in Vercel Dashboard
4. Deploy → note URL → update `REACT_APP_API_BASE` → redeploy

---

## ⚠️ Important Notes

- **No authentication required** — users open the site and start chatting immediately
- **In-memory storage** — conversations and uploaded files are lost on backend restart/redeploy. For persistence, swap `store.py` for PostgreSQL/Redis
- **Vercel cold starts** — the first request after deploy may be slow (~10-20s) while the embedding model downloads to `/tmp`
- **File uploads on Vercel** — files are stored in `/tmp` (writable). Vercel's body size limit is ~4.5MB for serverless; for larger files, use Vercel Blob or an external store

---

## 🛠️ Tech Stack

|               | Frontend                                       | Backend                        |
| ------------- | ---------------------------------------------- | ------------------------------ |
| Framework     | React 19                                       | FastAPI                        |
| UI            | Ant Design 6                                   | —                              |
| Auth          | None (dummy module)                            | None                           |
| Markdown      | react-markdown + remark-gfm + rehype-highlight | —                              |
| Notifications | react-toastify                                 | —                              |
| LLM           | —                                              | Groq API (LangChain)           |
| Embeddings    | —                                              | HuggingFace `all-MiniLM-L6-v2` |
| Vector Store  | —                                              | ChromaDB (in-memory)           |
| Testing       | React Testing Library + MSW                    | —                              |
| Hosting       | Vercel Services                                | Vercel Services                |

---

## 👤 Author

**FireLighT1337** — [github.com/FireLighT1337](https://github.com/FireLighT1337)
