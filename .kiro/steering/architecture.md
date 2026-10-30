# SaKAi Hub — Full Architecture Reference

## What This App Is
A **local-first Electron desktop application** — a multi-workspace AI development environment.
Solves "re-teach the AI" by keeping a persistent per-project file mirror + knowledge base
that can be injected into Claude, ChatGPT, Gemini, or Grok via their real web UIs.
No API keys. No proxies. Full provider UI preserved inside isolated BrowserViews.

---

## Process Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  RENDERER PROCESS  (React 18 + TypeScript + Zustand + Tailwind)     │
│                                                                      │
│  Pages                    Components               Stores            │
│  ─────────────────────    ──────────────────────   ───────────────   │
│  ProjectSelector          Sidebar (56/240px)        projectStore     │
│  Dashboard                ContextPanel (260px)      accountStore *   │
│  Chat                     AccountCard               contextStore     │
│  KnowledgeBase            KnowledgeCard             knowledgeStore   │
│  ProjectSettings          SwitchContextModal                         │
│  AppSettings              ModelSwitcher                              │
│                           ToastNotifications                         │
│                                                                      │
│  * accountStore is GLOBAL — never reset on project switch           │
│  All other per-project stores reset in projectStore.setActiveProject │
└────────────────────────────┬────────────────────────────────────────┘
                             │  contextBridge (window.api)
                             │  typed IPC — no raw ipcRenderer in renderer
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PRELOAD  electron/preload.ts                                        │
│  Exposes window.api groups:                                          │
│  projects | files | accounts | chats | knowledge |                   │
│  context  | webview | settings | ws                                  │
└────────────────────────────┬────────────────────────────────────────┘
                             │  ipcMain.handle / ipcRenderer.invoke
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  MAIN PROCESS  (Electron + Node.js + TypeScript)                     │
│                                                                      │
│  electron/main.ts          — bootstrap, BrowserWindow, IPC register  │
│  electron/db.ts            — SQLite via better-sqlite3               │
│  electron/fileWatcher.ts   — chokidar, 500ms debounce per file       │
│  electron/importScanner.ts — regex ES+CJS import parser (stateless)  │
│  electron/contextBuilder.ts — pure assembleContext() function        │
│  electron/tokenEstimator.ts — 4 chars/token approximation            │
│  electron/wsServer.ts      — ws server port 54321                    │
│  electron/webviewManager.ts — BrowserView lifecycle + adapters       │
│                                                                      │
│  handlers/                                                           │
│    projectHandlers.ts  accountHandlers.ts  chatHandlers.ts           │
│    knowledgeHandlers.ts  contextHandlers.ts  settingsHandlers.ts     │
│    webviewHandlers.ts                                                 │
└──────────┬──────────────────────┬───────────────────────────────────┘
           │                      │
    ┌──────▼──────┐        ┌──────▼──────────────────────────────────┐
    │  SQLite DB  │        │  BrowserViews (one per AI_Account)       │
    │  sakai-hub  │        │                                          │
    │  .db        │        │  persist:claude-{id}  → claude.ai        │
    │             │        │  persist:chatgpt-{id} → chatgpt.com      │
    │  tables:    │        │  persist:gemini-{id}  → gemini.google.com│
    │  projects   │        │  persist:grok-{id}    → grok.com         │
    │  app_settings        │                                          │
    │  project_files       │  ProviderAdapter interface:              │
    │  ai_accounts│        │    url, inputSelector, messageSelector   │
    │  chats      │        │    injectScript(), overlayScript()       │
    │  knowledge  │        └──────────────────────────────────────────┘
    │  _cards     │
    │  project    │        ┌──────────────────────────────────────────┐
    │  _settings  │        │  VS Code Extension  (vscode-extension/)  │
    └─────────────┘        │                                          │
                           │  wsClient.ts  → ws://localhost:54321     │
                           │  Sends: active-file | file-saved events  │
                           │  Retries every 5s on disconnect          │
                           │  Status bar: SaKAi Hub: Connected/Disconnected │
                           └──────────────────────────────────────────┘
```

---

## Data Flow: Context Injection

```
User opens Chat screen
        │
        ▼
ContextPanel (right, 260px)
  mode: smart | selected | full
  checkedFileIds[], checkedCardIds[]
        │
        ▼
window.api.context.assemble(AssembleContextInput)
        │  IPC
        ▼
assembleContext() ← pure function, deterministic, idempotent
  Smart:    activeFile + 1-level imports + recently changed (30min) + checked cards
  Selected: only checked files + checked cards
  Full:     folder tree + all non-ignored files + checked cards
        │
        ▼
Structured output (sections omitted if empty):
  ## Folder Structure
  ## Active File: {filename}
  ## Imported Files
  ## Recently Changed Files
  ## Knowledge Cards
  ## User Question
        │
        ▼
SwitchContextModal (shows preview + token estimate)
  warns at >80% of provider context window
  blocks at 100% (Full mode)
        │  user confirms
        ▼
webview.injectContext(accountId, contextBlock)
  → executeJavaScript via ProviderAdapter.injectScript()
  → fallback: copy to clipboard + show notification
```

---

## Data Flow: File Mirror

```
Project opened
        │
        ▼
FileWatcher.start(projectId, folderPath, ignorePatterns)
  Initial scan: recursive chokidar, writes to project_files
  Resolves with { fileCount, skipCount, completedAt }
        │
        ▼
  On add/change: debounce 500ms → write to project_files → importScanner.scanFile()
  On unlink: delete from project_files
  On folder gone: files:folderUnavailable IPC → Dashboard warning
        │
        ▼
importScanner.scanFile(content, filePath, projectRoot)
  ES module regex + CommonJS require regex
  Relative → path.resolve() → absolute
  Non-relative → "unresolved:{specifier}"
  Writes to project_files.imports (JSON array)
        │
        ▼
files:changed IPC → renderer ContextPanel refreshes
```

---

## Data Flow: VS Code Active File

```
VS Code editor focus changes
        │
        ▼
VS Code Extension sends: { type: 'active-file', path: '/abs/path/file.ts' }
        │ WebSocket port 54321
        ▼
WsServer.handleActiveFile(path)
  Prefix-match path against all projects[].folder_path
  Found → set is_active=1 for that file, is_active=0 for all others in that project
  Not found → silently discard (no DB write, no error)
        │
        ▼
Smart_Auto_Mode uses the is_active file as the context anchor
```

---

## Database Schema (SQLite, better-sqlite3)

```
projects          id(PK) | name | folder_path | created_at | last_opened_at
app_settings      key(PK) | value
project_files     id(PK) | project_id(FK→projects) | file_path | content | imports(JSON) | last_modified | is_active
ai_accounts       id(PK) | model | label | session_partition(UNIQUE) | is_active | created_at
chats             id(PK) | project_id(FK) | model | account_id(FK→ai_accounts) | title | created_at
knowledge_cards   id(PK) | project_id(FK) | content | category | tags(JSON) | source_model | source_chat_id(FK) | created_at
project_settings  project_id(PK/FK) | default_context_mode | auto_include_active_file | max_auto_context_tokens | ignore_patterns(JSON)

FK enforcement: PRAGMA foreign_keys = ON on every connection
Cascade deletes: project_files, chats, knowledge_cards, project_settings all cascade on projects(id) delete
ai_accounts has NO project_id — it is intentionally global
```

---

## IPC Channel Map

| Channel | Direction | Handler |
|---|---|---|
| `projects:list` | R→M | projectHandlers |
| `projects:create` | R→M | projectHandlers |
| `projects:open` | R→M | projectHandlers |
| `projects:rename` | R→M | projectHandlers |
| `projects:delete` | R→M | projectHandlers |
| `projects:updateFolderPath` | R→M | projectHandlers |
| `files:list` | R→M | (projectHandlers or fileHandlers) |
| `files:getImportGraph` | R→M | projectHandlers |
| `files:changed` | M→R | FileWatcher push |
| `files:folderUnavailable` | M→R | FileWatcher push |
| `accounts:list` | R→M | accountHandlers |
| `accounts:add` | R→M | accountHandlers |
| `accounts:setActive` | R→M | accountHandlers |
| `accounts:remove` | R→M | accountHandlers |
| `chats:list` | R→M | chatHandlers |
| `chats:create` | R→M | chatHandlers |
| `knowledge:list` | R→M | knowledgeHandlers |
| `knowledge:create` | R→M | knowledgeHandlers |
| `knowledge:delete` | R→M | knowledgeHandlers |
| `knowledge:search` | R→M | knowledgeHandlers |
| `context:assemble` | R→M | contextHandlers |
| `context:estimateTokens` | R→M | contextHandlers |
| `webview:injectContext` | R→M | webviewHandlers |
| `webview:saveKnowledge` | R→M | webviewHandlers |
| `settings:getApp` | R→M | settingsHandlers |
| `settings:setApp` | R→M | settingsHandlers |
| `settings:getProject` | R→M | settingsHandlers |
| `settings:setProject` | R→M | settingsHandlers |
| `ws:status` | M→R | WsServer push |
| `ws:activeFile` | M→R | WsServer push |

---

## UI Routes

| Route | Page | Condition |
|---|---|---|
| `/` | ProjectSelector | Always entry point on launch |
| `/dashboard` | Dashboard | Project open |
| `/chat` | Chat | Project open |
| `/knowledge` | KnowledgeBase | Project open |
| `/settings/project` | ProjectSettings | Project open |
| `/settings/app` | AppSettings | Always accessible |

Redirect: `/` → `/dashboard` when `projectStore.activeProject` is set.

---

## Provider Context Window Limits (for token warning)

| Provider | Limit |
|---|---|
| Claude | 200,000 tokens |
| ChatGPT | 128,000 tokens |
| Gemini | 1,000,000 tokens |
| Grok | 131,072 tokens |

Warning banner at 80% of limit. Block send at 100% (Full mode only).

---

## Project Isolation Rules

- Every per-project table row carries `project_id` FK — NO exceptions
- Every DB query for per-project data MUST include `WHERE project_id = ?`
- `ai_accounts` is the ONLY global table — no `project_id`
- Stores reset order on `projectStore.setActiveProject(newProject)`:
  1. `contextStore.reset()`
  2. `knowledgeStore.reset()`
  3. Then set new active project

---

## Key Correctness Properties (fast-check, 100 iterations each)

| # | Property | Tests |
|---|---|---|
| 1 | Project name validation (1–100 chars) | db.ts validation |
| 2 | Project list sort order (last_opened_at DESC) | db.ts listProjects |
| 3 | Project rename round-trip | db.ts renameProject |
| 4 | FK referential integrity | db.ts schema |
| 5 | Project isolation — no cross-project leakage | db.ts queries |
| 6 | Cascade delete removes all per-project rows | db.ts deleteProject |
| 7 | File scan count = disk files − ignored | fileWatcher.ts |
| 8 | Ignore filter invariant | fileWatcher.ts |
| 9 | Import scanner determinism | importScanner.ts |
| 10 | Relative import path resolution | importScanner.ts |
| 11 | Non-relative imports → "unresolved:" | importScanner.ts |
| 12 | Active-file routing by folder prefix | wsServer.ts |
| 13 | Context assembly idempotence | contextBuilder.ts |
| 14 | Section order + empty-section omission | contextBuilder.ts |
| 15 | File deduplication across selection sources | contextBuilder.ts |
| 16 | Context block prepend format | contextBuilder.ts |
| 17 | File code block labeling (relative path) | contextBuilder.ts |
| 18 | Knowledge card content round-trip identity | db.ts |
| 19 | Knowledge card deletion consistency | db.ts |
| 20 | Token estimation accuracy (±10% of tiktoken) | tokenEstimator.ts |
| 21 | Context output is valid UTF-8, no null bytes | contextBuilder.ts |
| 22 | Selected Files Mode exclusivity | contextBuilder.ts |
| 23 | Full Project Mode respects ignore list | contextBuilder.ts |

---

## Ignore List Defaults (always applied, not configurable)

```
node_modules/  .git/  dist/  build/  .next/  out/  coverage/  *.log  .DS_Store
```
User can add custom glob patterns via Project Settings → stored in `project_settings.ignore_patterns`.

---

## Session Partition Format

```
persist:{model}-{accountId}
e.g. persist:claude-a1b2c3d4
```

One active account per provider globally at any time (`is_active = 1`).
Setting one active sets all others for same model to `is_active = 0`.
