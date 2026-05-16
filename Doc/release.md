# Release v2.0.0: The Supercharged Update 🐾

Neko-Claw v2.0.0 is a major architecture overhaul that transforms the app from a simple AI wrapper into a robust computer control system. This update introduces local database persistence, real-time streaming, and a full-featured integrated developer environment.

## 🚀 Key Improvements

### 1. Robust SQLite Backend
We've migrated from flat JSON files to a high-performance **SQLite** database using `modernc.org/sqlite`. 
- **Persistence:** All chat history, memories, and souls are now stored in a structured relational database.
- **Auto-Migration:** Existing JSON data is automatically migrated on the first run.
- **Accurate Timestamps:** Every chat message now carries its own individual timestamp.

### 2. Real-Time Chat Streaming (SSE)
No more waiting! The AI now types its response word-by-word.
- Implemented **Server-Sent Events (SSE)** for zero-latency token delivery.
- Improved UI responsiveness with specialized `ReadableStream` handling.

### 3. Integrated File Explorer & Code Editor
Manage your workspace directly from the Neko-Claw interface.
- **Monaco Editor Engine:** The same high-quality editor used in VS Code is now built-in.
- **Filesystem API:** Browse, create, edit, and delete files with secure path-traversal protection.
- **Syntax Highlighting:** Support for Go, TypeScript, Python, Markdown, and more.

### 4. Hardware System Monitoring
Neko AI is now "aware" of your hardware state.
- **Real-time Stats:** Monitor CPU usage and RAM consumption directly in the header.
- **Context Injection:** The AI assistant sees your current OS, Username, Working Directory, and system load, allowing for more accurate technical assistance.

### 5. Rich Markdown & Syntax Highlighting
- Integrated `react-markdown` with GFM (GitHub Flavored Markdown) support.
- Professional code blocks with syntax highlighting and a one-click **Copy** button.
- Styled tables, blockquotes, and task lists for clear technical communication.

---

## 🛠️ Technical Changes
- Backend refactored to use a centralized Database store.
- Frontend upgraded with `@monaco-editor/react`.
- Added PowerShell bridging for hardware metrics collection.
- Optimized Next.js build configuration for production deployment.

## 🐱 How to Upgrade
1. Pull the latest changes from the repository.
2. Run `go build .` in the `agent` directory.
3. Run `npm install` and `npm run build` in the `ui` directory.
4. Launch the binary. Your data will migrate automatically!

---
*Meow! This version marks the beginning of Neko-Claw's evolution into a true AI-powered OS companion.*
