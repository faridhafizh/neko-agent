# Chat History Feature: Analysis & Optimization Plan

## Summary

After analyzing the Neko-Claw codebase, I've identified several performance bottlenecks, code quality issues, and UI improvements needed for the chat history feature.

---

## Issues Found

### Backend Issues

#### [chat_history.go] Performance — O(n²) Bubble Sort
The `GetSessions()` function uses a manual nested-loop sort instead of the stdlib's `sort.Slice`. For large histories this is wasteful.

#### [llm.go] Code Duplication — Tool Definition
The PowerShell tool definition (a very verbose JSON block) is **copy-pasted** into both `handleChat` and `handleApproveCommand`. This is hard to maintain and error-prone.

#### [llm.go] Missing Context Cancellation
The chat handler has no request timeout — if the AI provider hangs, the goroutine leaks indefinitely. Should add `context.WithTimeout`.

### Frontend Issues

#### [page.tsx] UX — No Session Search
With many chats, there's no way to search/filter sessions in the sidebar.

#### [page.tsx] UX — No Last Message Preview  
The session list shows only title + timestamp. A preview of the last message would make navigation much faster.

#### [page.tsx] UX — No Message Timestamps
Individual messages in the chat don't show timestamps, making it hard to understand when things happened in long sessions.

#### [page.tsx] Performance — Unnecessary Re-renders
`loadSessions()` fires after every single API action (create, archive, delete, rename). Should be batched/debounced.

#### [page.tsx] UX — Markdown Not Rendered  
AI responses are displayed as `<p>` plain text with `whitespace-pre-wrap`, so markdown formatting (bold, code, lists) from the AI is shown raw.

#### Layout / Visual Issues
- Header nav is missing a link to Memory management
- In the chat, messages use index `key={i}` which is an anti-pattern for lists
- The sidebar has no smooth animation for open/close
- No visual distinction between empty state and loading state
- The pending command panel is striking but could be more polished

---

## Proposed Changes

### Backend (Go)

---

#### [MODIFY] [chat_history.go](file:///d:/Websites/neko-claw/agent/chat_history.go)
- **Replace** the O(n²) bubble sort in `GetSessions()` with `sort.Slice()` — adds `"sort"` to imports
- Minor: add a `MessageCount` field in the `GetSessions()` response (added to `SessionSummary` in main.go handler)

#### [MODIFY] [llm.go](file:///d:/Websites/neko-claw/agent/llm.go)
- **Extract** the PowerShell tool definition into a package-level `var powershellTool openai.Tool`
- **Add** `context.WithTimeout(r.Context(), 60*time.Second)` for chat requests

#### [MODIFY] [main.go](file:///d:/Websites/neko-claw/agent/main.go)
- Add `MessageCount int` field to `SessionSummary` struct to expose message counts to frontend
- Add PATCH support for CORS middleware (currently missing)

---

### Frontend (Next.js / TypeScript)

---

#### [MODIFY] [api.ts](file:///d:/Websites/neko-claw/ui/src/lib/api.ts)
- Add `messageCount?: number` to `ChatSession` interface to display in sidebar

#### [MODIFY] [layout.tsx](file:///d:/Websites/neko-claw/ui/src/app/layout.tsx)
- Add Memory link to nav
- Mark active page with indicator

#### [MODIFY] [globals.css](file:///d:/Websites/neko-claw/ui/src/app/globals.css)
- Add CSS custom animations for sidebar slide, message pop-in, typing indicator, etc.
- Add smooth scrollbar styling
- Better font stack

#### [MODIFY] [page.tsx](file:///d:/Websites/neko-claw/ui/src/app/page.tsx) — Major Overhaul
- **Search bar** in sidebar to filter sessions by title
- **Last message preview** in each session card
- **Message timestamps** displayed below each message bubble  
- **Markdown rendering** using a lightweight parser (`marked` or manual regex for common patterns) — no new heavy deps
- **Sidebar animation** using CSS transition (translate-x) instead of conditional rendering
- **Stable keys** for message list (use index+role combo or shift to message objects with IDs)
- **Empty state** illustration (cat emoji + prompt text)
- **Loading skeleton** for sessions list
- **Visual polish**: gradient header in sidebar, colored category badges, better pending command panel
- **Keyboard shortcuts**: `Ctrl+N` for new chat, `Escape` to deselect session

---

## Implementation Order

1. Backend fixes (sort, dedup tool def, context timeout, message count)
2. API types update
3. Layout nav fix
4. CSS system overhaul
5. page.tsx rewrite with all UX improvements

## Verification Plan

### Automated Tests
- Compile Go backend: `go build ./...` in `d:\Websites\neko-claw\agent`
- Build Next.js UI: `npm run build` in `d:\Websites\neko-claw\ui`

### Manual Verification  
- Open browser to `http://localhost:8080` (or dev server at `http://localhost:3000`)
- Create a new chat, send messages, verify session appears in sidebar with preview
- Rename, archive, delete a session — verify sidebar updates correctly
- Search for a session by typing in search bar
- Verify AI markdown (bold, code blocks) renders correctly
