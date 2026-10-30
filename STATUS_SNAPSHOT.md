# SaKAi Hub — Status Snapshot
**Updated:** July 1, 2026

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        🟢 FRONTEND: 100% COMPLETE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ✅ Pages (6/6)          ✅ Stores (5/5)        ✅ Components (5/5)         │
│  ✅ Routing              ✅ Types               ✅ IPC Definitions          │
│  ✅ Glassmorphism        ✅ Tailwind Config     ✅ Animations              │
│  ✅ Zero TS Errors       ✅ Build Success       ✅ Professional Polish     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      🟡 BACKEND: 30% COMPLETE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ✅ Schema (db.ts)              ⚠️ DB Query Functions (NOT IMPL)           │
│  ✅ FileWatcher (impl)          ⚠️ FileWatcher → DB (NOT WIRED)            │
│  ✅ ImportScanner (impl)        ⚠️ ImportScanner → DB (NOT WIRED)          │
│  ✅ ContextBuilder (impl)       ⚠️ Handler Wiring (STUBBED)                │
│  ✅ TokenEstimator (impl)       ⚠️ WebviewManager (NOT IMPL)               │
│  ✅ WsServer (impl)             ⚠️ Provider Adapters (NOT IMPL)            │
│  ✅ IPC Handlers (registered)   ⚠️ Tests (NOT IMPL)                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Current State

### **What Works NOW (Frontend Only)**
```bash
npm run dev
```
- Opens Electron app with beautiful glassmorphism UI
- ProjectSelector renders with "No projects yet" empty state
- Can open Create Project modal → validates name/path → **fails on submit** (stub)
- Can navigate Dashboard/Chat/Knowledge → shows empty states
- Sidebar collapses/expands smoothly (56px ↔ 220px)
- Toasts appear/dismiss after 4 seconds
- All animations and transitions working
- Dark mode toggle in AppSettings (not persisted)

### **What Doesn't Work Yet (Backend Stubs)**
- Creating/opening/renaming/deleting projects → handlers return `null` / `[]`
- Adding AI accounts → handler returns `null`
- Creating chats → handler returns `null`
- Adding knowledge cards → handler returns `null`
- File watching → FileWatcher exists but doesn't write to DB
- Context injection → ContextBuilder exists but handlers return `""`
- VS Code extension → WsServer exists but doesn't update DB
- Persistence → nothing saves to DB because queries not implemented

---

## 📋 Next Steps (Backend Implementation)

### **Phase 1: Core DB Operations** ⏱️ 2–3 hours
**Goal:** Make all IPC handlers actually persist/retrieve data

**Tasks:**
1. Implement `db.ts` CRUD functions for all 7 tables
2. Wire handlers to call DB functions instead of returning stubs
3. Test: Create project → should persist and appear in list
4. Test: Add AI account → should persist and show in Dashboard
5. Test: Create chat → should persist and appear in Chat page
6. Test: Add knowledge card → should persist and appear in KnowledgeBase

**Files to Edit:**
- `electron/db.ts` (add ~400 lines of DB query functions)
- `electron/handlers/projectHandlers.ts` (replace 5 stubs)
- `electron/handlers/accountHandlers.ts` (replace 4 stubs)
- `electron/handlers/chatHandlers.ts` (replace 2 stubs)
- `electron/handlers/knowledgeHandlers.ts` (replace 4 stubs)
- `electron/handlers/settingsHandlers.ts` (replace 4 stubs)

**Success Criteria:**
- ✅ Create project → persists to DB → appears in ProjectSelector
- ✅ Open project → updates `last_opened_at` → loads in Dashboard
- ✅ Add AI account → persists to DB → shows in Dashboard provider cards
- ✅ Create chat → persists to DB → appears in Chat page list
- ✅ Add knowledge card → persists to DB → appears in KnowledgeBase grid

---

### **Phase 2: FileWatcher → DB Integration** ⏱️ 1–2 hours
**Goal:** Auto-scan project folder, write files to DB, track imports

**Tasks:**
1. Wire `FileWatcher.onFileChange()` to `db.upsertFile()`
2. After DB write, call `importScanner.scanFile()` → write imports
3. Wire `FileWatcher.onFileDelete()` to `db.deleteFile()`
4. Send `files:changed` IPC to renderer → refresh ContextPanel
5. Test: Create .ts file in watched folder → appears in ContextPanel

**Files to Edit:**
- `electron/fileWatcher.ts` (add DB calls in event handlers)
- `electron/handlers/projectHandlers.ts` (start FileWatcher on project open)

**Success Criteria:**
- ✅ Open project → FileWatcher scans folder → files appear in ContextPanel
- ✅ Edit file in VS Code → FileWatcher detects change → ContextPanel updates
- ✅ Delete file → FileWatcher detects → file removed from ContextPanel
- ✅ Import graph built → shows imported files in Smart Auto mode

---

### **Phase 3: WsServer Active-File Routing** ⏱️ 30 mins
**Goal:** VS Code extension → set active file → highlight in ContextPanel

**Tasks:**
1. Implement `WsServer.handleActiveFile()` to prefix-match path → `db.setActiveFile()`
2. Test: Open file in VS Code → active dot appears in ContextPanel

**Files to Edit:**
- `electron/wsServer.ts` (add DB call in `handleActiveFile()`)
- `electron/db.ts` (add `setActiveFile()` function)

**Success Criteria:**
- ✅ Open file in VS Code → WsServer receives event → DB updates `is_active`
- ✅ ContextPanel shows active file with dot indicator

---

### **Phase 4: Context Assembly** ⏱️ 30 mins
**Goal:** Assemble context block from files + cards

**Tasks:**
1. Wire `contextHandlers.ts` to call `assembleContext()` with real data
2. Test: Click Inject → modal shows context preview

**Files to Edit:**
- `electron/handlers/contextHandlers.ts` (replace stub with real `assembleContext()` call)

**Success Criteria:**
- ✅ Smart Auto mode → includes active file + imports + recent changes
- ✅ Selected mode → includes only checked files
- ✅ Full mode → includes all files (minus ignored)
- ✅ Knowledge cards appended to all modes

---

### **Phase 5: WebviewManager + Provider Adapters** ⏱️ 3–4 hours
**Goal:** Inject context into real AI provider UIs

**Tasks:**
1. Define `ProviderAdapter` interface
2. Implement 4 adapters: Claude, ChatGPT, Gemini, Grok
3. Implement `WebviewManager` to create/show BrowserViews
4. Wire `webviewHandlers.ts` to call WebviewManager
5. Test: Click Inject → BrowserView opens → context appears in AI input

**Files to Create:**
- `electron/webviewManager.ts` (~200 lines)
- `electron/adapters/ClaudeAdapter.ts` (~80 lines)
- `electron/adapters/ChatGPTAdapter.ts` (~80 lines)
- `electron/adapters/GeminiAdapter.ts` (~80 lines)
- `electron/adapters/GrokAdapter.ts` (~80 lines)

**Success Criteria:**
- ✅ Add AI account → BrowserView created with session partition
- ✅ Click Inject → BrowserView shown with provider URL loaded
- ✅ Context block injected into input field via executeJavaScript
- ✅ Fallback to clipboard if injection fails

---

### **Phase 6: Property-Based Tests** ⏱️ 4–6 hours
**Goal:** 100 iterations of 23 correctness properties

**Tasks:**
1. Install `fast-check` (already in devDependencies)
2. Write 23 test suites in `test/` folder
3. Run `npm test` → all pass

**Files to Create:**
- `test/db.test.ts` (project validation, isolation, cascade delete, FK integrity)
- `test/fileWatcher.test.ts` (scan count, ignore filter)
- `test/importScanner.test.ts` (determinism, relative path resolution)
- `test/contextBuilder.test.ts` (idempotence, section order, deduplication)
- `test/tokenEstimator.test.ts` (accuracy ±10%)
- `test/wsServer.test.ts` (active-file routing by prefix)

**Success Criteria:**
- ✅ `npm test` runs 2,300 test cases (23 properties × 100 iterations)
- ✅ All tests pass
- ✅ Code coverage > 80%

---

## 🎨 Visual Quality Summary

### **Frontend Polish Checklist**
- [x] Glassmorphism design system (backdrop blur, subtle borders, hover states)
- [x] 50+ Material Design 3 colors
- [x] Provider-specific accent colors (Claude orange, ChatGPT green, etc.)
- [x] Inter font with 7 semantic sizes
- [x] Staggered fade-in-up animations
- [x] Smooth transitions on all interactions
- [x] Empty states for all pages
- [x] Toast notifications (4 types)
- [x] Form validation with inline errors
- [x] Active link highlights
- [x] Sidebar collapse/expand animation
- [x] Context panel with live token estimate
- [x] Model switcher with provider dots
- [x] Multi-select with checkboxes
- [x] Locked default ignores (non-removable chips)
- [x] Relative time formatting ("just now", "2h ago", "yesterday")
- [x] Responsive modals with backdrop blur
- [x] Accessible ARIA labels and roles
- [x] Focus states on all interactive elements

### **UI/UX Highlights**
- **ProjectSelector:** Cycling accent colors per card, relative time, create/rename/delete modals
- **Dashboard:** Provider cards with live account status, add account modal, empty states
- **Chat:** 3-column layout (chat list / webview canvas / context panel), model switcher with dots
- **KnowledgeBase:** Full-width cards, multi-select with checkboxes, bulk inject, add note modal
- **ProjectSettings:** Locked default ignores, rename/delete project, change folder modal
- **AppSettings:** Dark mode toggle, WS status indicator, simple clean layout
- **Sidebar:** Click-toggle collapse (no hover), 56px ↔ 220px, active highlight, tooltips when collapsed
- **ContextPanel:** 3 modes (Smart Auto / Selected / Full), live token estimate, checkboxes, inject button

---

## 🔥 Key Architectural Decisions (Already Implemented)

1. **Global vs Per-Project Stores**
   - `accountStore` is **global** — never reset on project switch
   - All other stores reset when `projectStore.setActiveProject()` is called

2. **IPC Type Safety**
   - All IPC channels typed end-to-end via `window.api` in `preload.ts`
   - Zero `any` types in IPC definitions

3. **Project Isolation**
   - Every per-project table row has `project_id` FK
   - Cascade delete ensures no orphaned rows
   - Queries always include `WHERE project_id = ?`

4. **Context Assembly**
   - Pure function in `contextBuilder.ts` — deterministic, no side effects
   - 3 modes: Smart Auto (active + imports + recent), Selected (checked only), Full (all files)

5. **File Watching**
   - Chokidar with 500ms debounce per file
   - Default ignore patterns (node_modules, .git, dist, etc.)
   - User can add custom ignore patterns via ProjectSettings

6. **Token Estimation**
   - 4 chars/token approximation (GPT-4 average)
   - Warning at 80%, error at 100% of provider context window

7. **Provider Adapters**
   - Each provider has custom input selector, message selector, inject script
   - Fallback to clipboard if executeJavaScript fails

8. **VS Code Extension**
   - WebSocket on port 54321 (ws://localhost:54321)
   - Sends active-file events → WsServer prefix-matches to project → sets `is_active` flag

---

## 📦 Dependencies Summary

### **Production**
- `better-sqlite3` — SQLite DB (native, requires node-gyp)
- `chokidar` — File watcher
- `react` + `react-dom` — UI framework
- `react-router-dom` — Client-side routing
- `zustand` — State management
- `clsx` + `tailwind-merge` — Conditional class merging
- `lucide-react` — Icons (if used; verify)
- `uuid` — ID generation
- `ws` — WebSocket server

### **Development**
- `electron` + `electron-vite` + `electron-builder` — Desktop app framework
- `typescript` — Type safety
- `tailwindcss` + `@tailwindcss/forms` + `autoprefixer` + `postcss` — Styling
- `vite` + `@vitejs/plugin-react` — Build tool
- `vitest` + `fast-check` — Testing
- `@types/*` — TypeScript definitions

---

## 🚨 Known Limitations (By Design)

1. **No API Keys Needed**
   - App uses real web UIs inside BrowserViews
   - No proxies, no API key storage
   - User must log in once per provider

2. **Single Active Account per Provider**
   - Only one Claude account active at a time
   - Only one ChatGPT account active at a time
   - Switching providers in Chat page switches active account globally

3. **Ignore Patterns Not Real-Time**
   - Adding ignore patterns requires project re-open for full re-scan
   - FileWatcher doesn't hot-reload ignore rules

4. **No Undo for Project Delete**
   - Delete project → cascade delete all chats, files, cards, settings
   - Local files on disk are NOT deleted

5. **Context Injection Fallback**
   - If executeJavaScript fails → copy to clipboard + show toast
   - User must manually paste into AI input

6. **Token Estimation Approximate**
   - 4 chars/token is rough average
   - Actual token count may vary by ±10%

---

## 🎬 Ready to Build Backend?

You have **3 options**:

### **Option A: Full Backend Build (8–12 hours total)**
I can implement all 6 phases sequentially:
1. Core DB Operations → Handlers wired → Data persists ✅
2. FileWatcher → DB → Auto-scan works ✅
3. WsServer → Active file highlighting ✅
4. Context Assembly → Inject button works ✅
5. WebviewManager → BrowserView injection ✅
6. Property-based tests → 100% coverage ✅

**Result:** Fully functional app, ready to ship.

---

### **Option B: Incremental Build (Start with Phase 1)**
I can implement **Phase 1 only** (Core DB Operations, 2–3 hours):
- You'll be able to create/open/rename/delete projects
- Add AI accounts, create chats, add knowledge cards
- Everything persists to DB
- FileWatcher/Context/Webview still stubbed

**Result:** App is usable for project management + account setup.

---

### **Option C: Test Frontend First (0 hours)**
Run `npm run dev` and explore the UI with empty states:
- See the glassmorphism design
- Test modals, toasts, animations
- Verify routing, sidebar, context panel
- Then decide which backend phase to build first

**Result:** Confidence in UI quality before backend work.

---

**Which option would you like?**
