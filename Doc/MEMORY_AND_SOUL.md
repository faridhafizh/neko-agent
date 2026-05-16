# 🧠 Memory & Soul Features Documentation

## Overview

Neko-Claw now includes two powerful new features that enhance the AI assistant's capabilities:

1. **Memory System** - Persistent storage for important information that the AI can recall
2. **Soul System** - Personality profiles that change how the AI behaves and communicates

---

## 🧠 Memory System

### What is Memory?

The memory system allows Neko-Claw to remember important information across sessions. This includes:
- **Facts**: Important information about the user or their environment
- **Preferences**: User's preferred ways of doing things
- **Events**: Notable past interactions or accomplishments
- **Commands**: Frequently used or important PowerShell commands

### How It Works

1. **Automatic Memory Injection**: When you chat with Neko, the system searches for relevant memories based on your message and injects them into the AI's context
2. **Manual Memory Management**: You can add, view, search, and delete memories through the Memory Bank UI
3. **Priority System**: Memories have priority levels (1-5) that determine their importance
4. **Tagging**: Memories can be tagged for better organization and retrieval

### Using the Memory Bank

**Access**: Click "Manage" in the status bar or navigate to `/memory`

**Features**:
- **View Statistics**: See total memory count and breakdown by category
- **Add Memory**: Fill out the form with:
  - Content: What to remember
  - Category: facts, preferences, events, or commands
  - Priority: 1 (low) to 5 (high)
  - Tags: Comma-separated tags for better search
- **Filter by Category**: Click category buttons to filter memories
- **Delete Memory**: Click the "Delete" button on any memory card

### API Endpoints

```
GET    /api/memory              - Get all memories (optional ?category= filter)
POST   /api/memory              - Add new memory
DELETE /api/memory?id=<id>      - Delete a memory
GET    /api/memory/search?q=<q> - Search memories
GET    /api/memory/stats        - Get memory statistics
```

**Example: Add Memory**
```json
POST /api/memory
{
  "content": "User prefers PowerShell over CMD for all commands",
  "category": "preferences",
  "priority": 4,
  "tags": ["powershell", "shell", "preference"]
}
```

### Memory in Action

When you ask "How do I list files?", Neko will:
1. Search memories for relevant information
2. Find any memories about "list files", "PowerShell", etc.
3. Inject those memories into the AI's context
4. Provide a more personalized response based on past interactions

---

## 🎭 Soul System

### What is a Soul?

A Soul is a personality profile that determines how Neko-Claw behaves and communicates. Each soul has:
- A unique personality trait
- Custom system prompt
- Distinctive emoji
- Color theme

### Available Souls

1. **Default Neko** 🐱
   - Balanced, friendly cat assistant
   - Warm, cat-like personality with occasional cat expressions

2. **Playful Neko** 😺
   - Energetic, fun-loving cat
   - Uses lots of exclamation marks and cat puns
   - Very enthusiastic about everything

3. **Scholarly Neko** 🧐
   - Wise, intellectual cat with refined manners
   - Sophisticated vocabulary and detailed explanations
   - Professor-like demeanor

4. **Efficient Neko** ⚡
   - Minimalist, task-oriented
   - Concise, direct communication
   - Minimal cat puns, maximum productivity

5. **Creative Neko** 🎨
   - Artistic, imaginative cat
   - Uses metaphors and vivid descriptions
   - Creative approach to problem-solving

### How to Change Souls

**Via Settings Page**:
1. Navigate to `/settings`
2. Scroll to "Neko Soul (Personality)" section
3. Click on any soul card to activate it
4. The change is immediate - no need to save!

**Via API**:
```
GET  /api/souls/active       - Get current active soul
GET  /api/souls              - Get all available souls
POST /api/souls/active       - Set active soul
```

**Example: Change Soul**
```json
POST /api/souls/active
{
  "soulId": "playful"
}
```

### Soul Status Bar

The status bar at the top of the chat shows:
- Current soul emoji (e.g., 🐱, 😺, 🧐)
- Current soul name (e.g., "Default Neko")
- Total memory count
- Quick links to Memory and Settings pages

### How Souls Work

When you change the soul:
1. The active soul profile is saved to `data/souls.json`
2. The next chat message will use the new soul's system prompt
3. The AI's personality, tone, and communication style change accordingly
4. The status bar updates to show the active soul

---

## 💾 Data Storage

All memory and soul data is stored persistently in the `data/` directory:

```
data/
├── settings.json    - API configuration
├── memories.json    - All memories
└── souls.json       - Soul profiles and active selection
```

This data persists across server restarts and is loaded automatically on startup.

---

## 🎯 Use Cases

### Memory Examples

**Remember User Preferences**:
```
Category: preferences
Priority: 5
Content: "User prefers to work in d:\Projects directory"
Tags: [directory, workspace, preference]
```

**Save Important Commands**:
```
Category: commands
Priority: 4
Content: "To restart the web server, use: pm2 restart web-app"
Tags: [server, restart, pm2]
```

**Record Accomplishments**:
```
Category: events
Priority: 3
Content: "Successfully set up Docker containers on 2026-04-01"
Tags: [docker, setup, milestone]
```

**Store Facts**:
```
Category: facts
Priority: 5
Content: "User's primary development machine is Windows 11"
Tags: [windows, OS, environment]
```

### Soul Selection Guide

- **Default**: General assistance, everyday tasks
- **Playful**: When you want a fun, energetic companion
- **Scholarly**: Complex technical tasks requiring detailed explanations
- **Efficient**: Quick tasks, no-nonsense productivity
- **Creative**: Brainstorming, creative problem-solving, artistic tasks

---

## 🔧 Technical Implementation

### Backend (Go)

- **memory.go**: Memory store with CRUD operations, search, and statistics
- **soul.go**: Soul profile management with default souls and activation
- **llm.go**: Integration with LLM - injects memories and soul into system prompt
- **main.go**: API endpoints for memory and soul management

### Frontend (Next.js/React)

- **api.ts**: TypeScript API client functions for memory and soul endpoints
- **page.tsx**: Main chat page with soul status bar
- **memory/page.tsx**: Full memory management UI
- **settings/page.tsx**: Soul selection cards + API settings

---

## 🚀 Tips for Best Results

1. **Add High-Priority Memories**: Use priority 4-5 for critical information you want the AI to always remember
2. **Tag Generously**: More tags = better search results when memories are retrieved
3. **Match Soul to Task**: Switch souls based on what you're doing (efficient for quick tasks, scholarly for learning)
4. **Review Memories**: Periodically check your memory bank to keep it relevant
5. **Experiment with Souls**: Try different souls to find the personality that works best for you

---

## 🐛 Troubleshooting

**Memories not being recalled?**
- Check that memories exist in the correct category
- Ensure your query matches memory content or tags
- Higher priority memories are retrieved first

**Soul change not taking effect?**
- The soul change affects the NEXT message you send
- Check that the soul was saved (refresh settings page)
- Verify `data/souls.json` has the correct activeSoul value

**Data lost after restart?**
- Ensure the `data/` directory has proper write permissions
- Check for any file system errors in the console

---

## 🎉 Future Enhancements

Potential future improvements:
- Automatic memory extraction from conversations
- Memory similarity scoring for better recall
- Custom soul creation by users
- Soul memory: souls that remember specific topics better
- Memory decay: old memories fade over time
- Memory categories for projects/contexts

---

*Made with 🐾 and AI - Neko-Claw now remembers and has personality!*
