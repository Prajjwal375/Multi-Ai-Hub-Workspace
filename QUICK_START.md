# SaKAi Hub — Quick Start Guide
**For Developers Picking Up This Project**

---

## 🚀 Get Running in 30 Seconds

```bash
# 1. Install dependencies (if not already done)
npm install

# 2. Start development server
npm run dev

# App window opens → shows ProjectSelector with empty state
# All UI works, but data doesn't persist (backend stubbed)
```

---

## 📂 Project Structure (Read This First)

```
SaKAi multihub/
├── src/                      # React frontend (100% complete)
│   ├── pages/                # 6 pages: ProjectSelector, Dashboard, Chat, KnowledgeBase, ProjectSettings, AppSettings
│   ├── components/           # 5 shared: Sidebar, ContextPanel, ToastContainer, GlassCard, SnowEffect
│   ├── store/                # 5 Zustand stores: project, account, context, knowledge, ui
│   ├── types/                # All TypeScript types + IPC definitions
│   ├── styles/               # globals.css with glassmorphism + animations
│   ├── App.tsx               # Router + layout logic
│   └── main.tsx              # React entry point
│
├── electron/                 # Electron backend (30% complete)
│   ├── main.ts               # App bootstrap, IPC registration, WsServer start
│   ├── preload.ts            # contextBridge, window.api exposure (fully typed)
│   ├── db.ts                 # SQLite schema defined, query functions STUBBED
│   ├── fileWatcher.ts        # Chokidar watcher IMPLEMENTED, DB wiring MISSING
│   ├── importScanner.ts      # ES/CJS import parser IMPLEMENTED
│   ├── contextBuilder.ts     # Pure function context assembly IMPLEMENTED
│   ├── tokenEstimator.ts     # 4 chars/token approximation IMPLEMENTED
│   ├── wsServer.ts           # WebSocket server IMPLEMENTED, DB wiring MISSING
│   └── handlers/             # 7 IPC handler files ALL STUBBED
│       ├── projectHandlers.ts
│       ├── accountHandlers.ts
│       ├── chatHandlers.ts
│       ├── knowledgeHandlers.ts
│       ├── contextHandlers.ts
│       ├── settingsHandlers.ts
│       └── webviewHandlers.ts
│
├── .kiro/                    # Kiro workspace settings
│   └── steering/             # Architecture docs
│       └── architecture.md   # Full system design (READ THIS)
│
├── package.json              # Dependencies (all installed)
├── tailwind.config.js        # 50+ custom colors, animations, fonts
├── electron.vite.config.ts   # Build config for main/preload/renderer
├── tsconfig.json             # TypeScript config
│
└── Documentation (created today)
    ├── FINAL_VERIFICATION.md  # Detailed completion report
    ├── STATUS_SNAPSHOT.md     # Visual status + next steps
    └── QUICK_START.md         # This file
```

---

## 🎯 What Works vs What Doesn't

### ✅ **Works NOW (Frontend)**
- Open app → ProjectSelector renders with empty state
- Modals open/close (create project, rename, delete, add account, add note)
- Sidebar collapses/expands (56px ↔ 220px) on click
- Routing between pages works
- Toasts appear/disappear after 4 seconds
- Form validation shows inline errors
- Animations and transitions smooth
- Dark mode toggle in AppSettings (not persisted)
- Context panel shows 3 modes + live token estimate (0 because no files)

### ❌ **Doesn't Work Yet (Backend Stubs)**
- Create project → fails because `projects:create` returns `null`
- Add AI account → fails because `accounts:add` returns `null`
- Create chat → fails because `chats:create` returns `null`
- Add knowledge card → fails because `knowledge:create` returns `null`
- File watching → FileWatcher exists but doesn't write to DB
- Context injection → assembleContext() exists but handlers return empty string
- VS Code integration → WsServer runs but doesn't update DB

---

## 🛠️ Build the Backend (Choose Your Path)

### **Path 1: Full Implementation (8–12 hours)**
Complete all 6 phases → fully functional app

### **Path 2: Core CRUD First (2–3 hours)**
Implement Phase 1 only → project/account/chat/knowledge CRUD works

### **Path 3: Just Explore**
Run `npm run dev` → see the UI → decide what to build next

---

## 📖 Key Files to Understand

### **Frontend Entry Points**
1. `src/main.tsx` → React root, wraps `<App />` in `<HashRouter>`
2. `src/App.tsx` → Routing logic, `<ProjectLayout>` wrapper, `<SettingsRoute>` wrapper
3. `src/store/projectStore.ts` → Project state management (GLOBAL on purpose for `accountStore`)

### **Backend Entry Points**
1. `electron/main.ts` → Electron bootstrap, registers all IPC handlers, starts WsServer
2. `electron/preload.ts` → contextBridge, exposes `window.api` to renderer
3. `electron/db.ts` → SQLite schema + query functions (SCHEMA DONE, QUERIES STUBBED)

### **Core Logic (Already Implemented)**
1. `electron/fileWatcher.ts` — Chokidar watcher, 500ms debounce, ignore patterns
2. `electron/importScanner.ts` — Regex parser for ES + CJS imports
3. `electron/contextBuilder.ts` — Pure function, 3 modes, deterministic output
4. `electron/tokenEstimator.ts` — 4 chars/token approximation
5. `electron/wsServer.ts` — WebSocket server on port 54321

---

## 🔧 Common Commands

```bash
# Development (hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Package as installer
npm run package

# Run tests (once implemented)
npm test

# Run tests in watch mode
npm run test:watch
```

---

## 🧪 Testing the Frontend (No Backend Needed)

### **What You Can Test Right Now:**
1. **ProjectSelector Page**
   - Click "Create New Project" → modal opens
   - Enter name + path → validation works
   - Submit → fails (expected), but modal logic works

2. **Sidebar**
   - Click menu icon → sidebar expands/collapses
   - Click nav items → routing works
   - Click "Switch Project" → navigates to ProjectSelector
   - Click "App Settings" → navigates to AppSettings

3. **Dashboard Page**
   - Shows 4 provider cards (Claude, ChatGPT, Gemini, Grok)
   - Click "Connect [Provider] Account" → modal opens
   - Enter label → validation works
   - Submit → fails (expected), but modal logic works

4. **Chat Page**
   - Shows 3-column layout (chat list / webview canvas / context panel)
   - Model switcher at top (4 dots: Claude, ChatGPT, Gemini, Grok)
   - Click dot → switches active model
   - Context panel shows 3 mode tabs (Smart Auto / Selected / Full)

5. **KnowledgeBase Page**
   - Shows full-width card grid
   - Click "Add Knowledge Note" → modal opens
   - Enter content + category + tags → validation works
   - Submit → fails (expected), but modal logic works

6. **ProjectSettings Page**
   - Shows locked default ignores (gray chips, no X button)
   - Can add custom ignore patterns (blue chips, X button to remove)
   - Click "Rename Project" → modal opens
   - Click "Delete Project" → modal opens with danger styling

7. **AppSettings Page**
   - Dark mode toggle (works in state, not persisted)
   - WS status indicator (shows "Disconnected" because no project open)

---

## 🎨 Design System Reference

### **Colors**
- Primary: `#0058be` (blue)
- Provider colors:
  - Claude: `#D4A27F` (orange)
  - ChatGPT: `#74AA9C` (green)
  - Gemini: `#4285F4` (blue)
  - Grok: `#1DA1F2` (twitter blue)

### **Glassmorphism Classes**
- `glass-panel` — Sidebar, ContextPanel, main containers
- `glass-card` — Cards, modals, smaller containers
- `glass-input` — Text inputs, textareas
- `glass-card-danger` — Delete modals

### **Animations**
- `fade-in-up` — Staggered entrance animations (use with `delay-1` through `delay-5`)
- `float` — Decorative floating elements

### **Typography**
- `font-display-lg` — 48px, bold, -2% letter-spacing (page titles)
- `font-headline-lg` — 32px, semibold, -1% letter-spacing (section headers)
- `font-headline-md` — 24px, semibold (card headers)
- `font-body-lg` — 18px, normal (intro text)
- `font-body-md` — 16px, normal (body text)
- `font-label-md` — 14px, medium, 1% letter-spacing (buttons, nav)
- `font-label-sm` — 12px, medium (labels, captions)

---

## 🔑 Key Architectural Concepts

### **1. Project Isolation**
- Every per-project table row has `project_id` FK
- All queries include `WHERE project_id = ?`
- Cascade delete ensures no orphaned rows
- `ai_accounts` is the ONLY global table (no `project_id`)

### **2. Store Reset Order**
When `projectStore.setActiveProject()` is called:
1. `contextStore.reset()` — clears checked files/cards, resets token estimate
2. `knowledgeStore.reset()` — clears cards
3. Set new active project
4. Re-fetch data for new project

**`accountStore` is NEVER reset** — it's global across all projects.

### **3. Context Modes**
- **Smart Auto:** Active file + 1-level imports + recently changed (30min) + checked cards
- **Selected:** Only checked files + checked cards
- **Full:** All files (minus ignored) + checked cards

### **4. IPC Flow**
```
Renderer (React)
    ↓ window.api.projects.create({ name, folderPath })
Preload (contextBridge)
    ↓ ipcRenderer.invoke('projects:create', input)
Main (IPC handler)
    ↓ db.createProject(input)
SQLite DB
    ↓ returns Project object
Main (IPC handler)
    ↓ return project
Preload (contextBridge)
    ↓ resolves Promise<Project>
Renderer (React)
    ↓ updates state, navigates to /project/:id/dashboard
```

### **5. File Watching Flow**
```
User opens project
    ↓ FileWatcher.start(projectId, folderPath, ignorePatterns)
Chokidar scans folder
    ↓ emits 'add' event for each file
FileWatcher.onFileChange(filePath)
    ↓ debounce 500ms → read file content
    ↓ db.upsertFile(projectId, filePath, content, [])
    ↓ importScanner.scanFile(content, filePath, projectRoot)
    ↓ db.updateFileImports(projectId, filePath, imports)
    ↓ mainWindow.webContents.send('files:changed')
Renderer receives 'files:changed' IPC
    ↓ ContextPanel calls loadFiles()
    ↓ Files appear in checked list
```

---

## 🚨 Common Issues & Solutions

### **Issue: "better-sqlite3 native module error"**
**Solution:** Run `npm run postinstall` to rebuild native modules for your Electron version.

### **Issue: "Port 54321 already in use"**
**Solution:** Change port in `wsServer.ts` line 6: `{ host: 'localhost', port: 54322 }`

### **Issue: "Dark mode doesn't persist"**
**Expected:** Dark mode toggle works in state but not persisted to DB yet (backend stub).

### **Issue: "Create project fails silently"**
**Expected:** `projects:create` handler returns `null` because DB queries not implemented.

### **Issue: "TypeScript errors in imports"**
**Solution:** Run `npm install` to ensure all `@types/*` packages are installed.

---

## 📚 Recommended Reading Order

1. **QUICK_START.md** (this file) — Overview + how to run
2. **STATUS_SNAPSHOT.md** — What's done vs what's next
3. **architecture.md** (in `.kiro/steering/`) — Full system design
4. **FINAL_VERIFICATION.md** — Detailed completion report

---

## 🎯 Where to Start Building

### **If You Want to See Data Persist:**
→ Start with `electron/db.ts` → implement all CRUD functions  
→ Then wire `electron/handlers/projectHandlers.ts`

### **If You Want File Watching to Work:**
→ Implement Phase 2 (FileWatcher → DB Integration)  
→ Files to edit: `electron/fileWatcher.ts`, `electron/db.ts`

### **If You Want Context Injection to Work:**
→ Implement Phase 4 (WebviewManager + Provider Adapters)  
→ Files to create: `electron/webviewManager.ts`, `electron/adapters/`

### **If You Want Tests:**
→ Implement Phase 6 (Property-Based Tests)  
→ Files to create: `test/db.test.ts`, `test/fileWatcher.test.ts`, etc.

---

## 💡 Pro Tips

1. **Read `architecture.md` first** — It has the full design, IPC channel map, and correctness properties.
2. **Use `get_diagnostics` tool** — Run diagnostics on files after editing to catch TS errors early.
3. **Test incrementally** — After implementing each DB function, test it via `npm run dev`.
4. **Console.log liberally** — Main process logs appear in terminal, renderer logs in DevTools.
5. **Use DevTools** — Press `Ctrl+Shift+I` (Windows) to open React DevTools + inspect network/console.
6. **Check DB with CLI** — Run `sqlite3 ~/AppData/Roaming/sakai-hub/sakai-hub.db` to inspect tables.

---

## 🤝 Need Help?

- **Architecture questions:** Read `.kiro/steering/architecture.md`
- **TypeScript errors:** Check `src/types/index.ts` for type definitions
- **IPC issues:** Check `electron/preload.ts` for exposed API methods
- **State management:** Check `src/store/` files for Zustand store logic
- **UI bugs:** Check `src/pages/` and `src/components/` for React components

---

**Happy building! 🚀**
