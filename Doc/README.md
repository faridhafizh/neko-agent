# 🐱 Neko-Claw AI Controller

Neko-Claw is a powerful and "pawsome" computer control superapp that allows you to interact with your Windows machine using AI. Featuring a sleek cat-themed UI and powered by Zhipu AI (GLM-4), it provides a safe yet efficient way to automate tasks through PowerShell commands.

![Neko-Claw UI](.qwen/screenshot_placeholder.png) *Note: Aesthetic cat-themed interface with amber and stone color palette.*

## 🐾 Features

### Core Features
- **Cat-Themed Interface**: A warm, user-friendly UI designed with a premium "Neko" aesthetic.
- **Human-in-the-Loop Safety**: AI proposes PowerShell commands, but nothing runs without your explicit "Purr-fect" (Approve) or "Hiss" (Reject).
- **Zhipu AI Integration**: Optimized for `glm-4.7-flash` model out of the box.
- **One-Command Start**: Intelligent backend that automatically builds the Next.js frontend if needed.
- **Smart Output Cleaning**: Automatically strips ANSI escape codes from terminal outputs for clean readability.
- **Flexible Configuration**: Easily change API Keys, Models, and URLs directly from the Settings menu.

### 🧠 Memory System
Give Neko the ability to remember important information across sessions with a comprehensive memory management system:

- **Persistent Memory Storage**: Store facts, preferences, events, and commands that persist between sessions
- **Smart Auto-Recall**: Relevant memories are automatically retrieved and injected into AI context based on your conversation
- **Priority System**: Rate memories from 1-5 to control which information gets recalled first (higher priority = more important)
- **Tag-Based Organization**: Add custom tags to memories for better searchability and retrieval
- **Category Filtering**: Organize memories into four categories:
  - **Facts**: Important information about you or your environment
  - **Preferences**: Your preferred ways of doing things
  - **Events**: Notable past interactions or accomplishments
  - **Commands**: Frequently used or important PowerShell commands
- **Memory Statistics Dashboard**: View total memory count and breakdown by category
- **Full CRUD Operations**: Add, view, search, filter, and delete memories through an intuitive UI
- **Automatic Timestamps**: Track when memories were created and last used

### 🎭 Soul System (AI Personalities)
Transform Neko's personality and communication style with five unique soul profiles:

- **🐱 Default Neko**: A balanced, friendly cat assistant with a warm personality
- **😺 Playful Neko**: An energetic, fun-loving cat that uses lots of exclamation marks and cat puns
- **🧐 Scholarly Neko**: A wise, intellectual cat with sophisticated vocabulary and detailed explanations
- **⚡ Efficient Neko**: A minimalist, task-oriented cat focused on concise, direct communication
- **🎨 Creative Neko**: An artistic, imaginative cat that uses metaphors and vivid descriptions

**Soul Features:**
- **Instant Personality Switching**: Click any soul card to immediately change Neko's personality
- **Custom System Prompts**: Each soul has a unique system prompt that shapes AI behavior
- **Visual Identity**: Each soul has its own emoji and color theme
- **Persistent Selection**: Active soul is saved and restored across sessions
- **Status Bar Display**: Shows current soul emoji and name in the chat interface

## 🛠️ Tech Stack

- **Backend**: Go (Golang)
- **Frontend**: Next.js (TypeScript, Tailwind CSS)
- **AI Integration**: OpenAI-compatible API (Zhipu AI Recommended)

## 🚀 Getting Started

### Prerequisites

- [Go](https://go.dev/dl/) 1.20+
- [Node.js & npm](https://nodejs.org/) (for building the UI)
- [PowerShell/pwsh](https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell) (standard on Windows)

### Installation & Running

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/neko-claw.git
   cd neko-claw
   ```

2. **Run the application**:
   Navigate to the `agent` folder and run the Go server. It will automatically install UI dependencies and build the frontend on the first run.
   ```bash
   cd agent
   go run .
   ```

3. **Access the App**:
   Open your browser and go to `http://localhost:8080`.

## ⚙️ Configuration

Once the app is running:
1. Click on **⚙️ Settings** in the top navigation bar.
2. Enter your **Zhipu AI API Key** (get it from [BigModel.cn](https://open.bigmodel.cn/)).
3. Ensure the Endpoint is set to: `https://open.bigmodel.cn/api/paas/v4/`
4. Save the configuration and start chatting with Neko!

### 🎭 Changing Neko's Personality

1. Go to **⚙️ Settings**
2. Scroll to **Neko Soul (Personality)** section
3. Click on any soul card to instantly change Neko's personality:
   - 🐱 **Default Neko**: Friendly and balanced
   - 😺 **Playful Neko**: Energetic and fun-loving
   - 🧐 **Scholarly Neko**: Wise and intellectual
   - ⚡ **Efficient Neko**: Minimalist and productive
   - 🎨 **Creative Neko**: Artistic and imaginative

### 🧠 Using the Memory System

1. Click **Manage** in the status bar or go to `/memory`
2. View memory statistics and all stored memories
3. Add new memories with:
   - **Content**: What Neko should remember
   - **Category**: facts, preferences, events, or commands
   - **Priority**: 1 (low) to 5 (high) - controls recall order
   - **Tags**: Comma-separated tags for better search (e.g., "powershell, directory, workflow")
4. Filter memories by category using the filter buttons
5. Delete memories you no longer need
6. Neko will automatically recall relevant memories during conversations based on your messages

### 💾 Data Storage

All memory and soul data is stored persistently in the `data/` directory:

```
data/
├── settings.json    - API configuration
├── memories.json    - All memories with tags and priorities
└── souls.json       - Soul profiles and active selection
```

Data persists across server restarts and is loaded automatically on startup.

### 🔌 API Endpoints

**Memory Endpoints:**
```
GET    /api/memory              - Get all memories (optional ?category= filter)
POST   /api/memory              - Add new memory
DELETE /api/memory?id=<id>      - Delete a memory by ID
GET    /api/memory/search?q=<q> - Search memories by content or tags
GET    /api/memory/stats        - Get memory statistics
```

**Soul Endpoints:**
```
GET  /api/souls              - Get all available soul profiles
GET  /api/souls/active       - Get currently active soul
POST /api/souls/active       - Set active soul (body: {"soulId": "playful"})
```

## ⚠️ Safety Warning

This application allows an AI to suggest commands that can modify your system. **Always review the commands in the approval box before clicking "Purr-fect"**.

## 📚 Additional Documentation

For more detailed information about the memory and soul features, including use cases, examples, and troubleshooting, see [MEMORY_AND_SOUL.md](MEMORY_AND_SOUL.md).

---

*Made with 🐾 and AI.*
