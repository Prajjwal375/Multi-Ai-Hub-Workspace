# Implementation Plan: SaKAi Hub

## Overview

Incrementally build the Electron desktop application following the 4-week schedule. Each week's tasks build directly on the previous week's output so that every code path is integrated before moving forward. The implementation language is **TypeScript** throughout (Electron main process, React renderer, and VS Code extension).

---

## Tasks

### Week 1 — Foundation

- [ ] 1. Scaffold Electron + electron-vite project and configure TypeScript
  - [ ] 1.1 Initialise the electron-vite project with React + TypeScript renderer template
    - Run `npm create electron-vite@latest` with the react-ts template
    - Verify `electron/main.ts`, `electron/preload.ts`, and `src/` scaffold are present
    - Configure `tsconfig.json` for strict mode in both main and renderer
    - _Requirements: overall project structure_
  - [ ]* 1.2 Write smoke test confirming the app window opens without errors
    - Use vitest + `@electron/test-utils` or a simple process-spawn check
    - _Requirements: 13.1_

- [ ] 2. Initialise SQLite database schema and migration runner
  - [ ] 2.1 Install `better-sqlite3` and create `electron/db.ts` with schema initialisation
    - Implement `initDatabase()` that runs `PRAGMA foreign_keys = ON` and executes all `CREATE TABLE` and `CREATE INDEX` statements from the design
    - Tables: `projects`, `app_settings`, `project_files`, `ai_accounts`, `chats`, `knowledge_cards`, `project_settings`
    - Use a simple version-flag row in `app_settings` as a migration guard
    - _Requirements: 1.1, 2.1, 8.3, 10.1_
  - [ ]* 2.2 Write property test for referential integrity (Property 4)
    - **Property 4: Referential integrity — project_files foreign key**
    - **Validates: Requirements 2.1, 17.1**
  - [ ]* 2.3 Write property test for project isolation (Property 5)
    - **Property 5: Project isolation — no cross-project data leakage**
    - **Validates: Requirements 2.2, 2.3, 2.5, 17.6**
  - [ ]* 2.4 Write property test for cascade delete (Property 6)
    - **Property 6: Cascade delete removes all per-project rows**
    - **Validates: Requirements 1.6, 2.6**

- [ ] 3. Build the typed IPC bridge (preload + handler registration)
  - [ ] 3.1 Implement `electron/preload.ts` exposing `window.api` via `contextBridge`
    - Expose all API groups from the design: `projects`, `files`, `accounts`, `chats`, `knowledge`, `context`, `webview`, `settings`, `ws`
    - All channels must be typed; no raw `ipcRenderer.invoke` calls in the renderer
    - _Requirements: overall architecture_
  - [ ] 3.2 Register stub IPC handlers in `electron/main.ts` for every channel
    - Each handler returns a typed placeholder so the renderer can compile and route without real implementations yet
    - _Requirements: overall architecture_
  - [ ]* 3.3 Write unit tests for IPC channel registration
    - Verify every channel name in `preload.ts` has a corresponding `ipcMain.handle` registration
    - _Requirements: overall architecture_

- [ ] 4. Implement project CRUD and validation logic
  - [ ] 4.1 Implement project DB helpers in `electron/db.ts`: `listProjects`, `createProject`, `openProject`, `renameProject`, `deleteProject`
    - `listProjects` sorts by `last_opened_at` DESC
    - `createProject` validates name length (1–100) and `folder_path` existence before INSERT
    - `openProject` updates `last_opened_at` to current UTC
    - `deleteProject` wraps the DELETE in a transaction; rolls back on any table failure
    - `renameProject` updates `projects.name`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11_
  - [ ]* 4.2 Write property test for project name validation (Property 1)
    - **Property 1: Project name validation accepts valid and rejects invalid inputs**
    - **Validates: Requirements 1.2, 1.8**
  - [ ]* 4.3 Write property test for project list sort order (Property 2)
    - **Property 2: Project list sort order invariant**
    - **Validates: Requirements 1.5**
  - [ ]* 4.4 Write property test for project rename round-trip (Property 3)
    - **Property 3: Project rename round-trip**
    - **Validates: Requirements 1.11**
  - [ ]* 4.5 Write unit tests for project creation validation
    - Test empty name, name > 100 chars, non-existent folder path, valid inputs
    - Test 50-project capacity (Req 1.9)
    - _Requirements: 1.7, 1.8, 1.9_

- [ ] 5. Build Project Selector screen (`src/pages/ProjectSelector.tsx`)
  - [ ] 5.1 Create `src/pages/ProjectSelector.tsx` with project list, "+ New Project" button, and creation form
    - Display name, folder_path, last_opened_at for each project sorted by last_opened_at DESC
    - Creation form: name field (1–100 chars), folder picker via `window.api.projects.create`
    - Show field-level validation errors on submit failure
    - On project click: call `window.api.projects.open(id)` then navigate to Dashboard; show error and stay on page if open fails
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.7_
  - [ ]* 5.2 Write unit tests for ProjectSelector
    - Test renders project list, form validation messages, navigation on project click
    - _Requirements: 13.1, 13.2, 13.3_

- [ ] 6. Build Sidebar component and client-side routing
  - [ ] 6.1 Create `src/components/Sidebar.tsx` (collapsible, 56 px / 240 px)
    - Navigation items: Dashboard, Chat, Knowledge Base, Project Settings; App Settings pinned at bottom
    - Use Material Symbols icons as specified in the design
    - Include "Switch Project" control that calls `projectStore.setActiveProject(null)` and navigates to Project Selector
    - _Requirements: 13.5, 13.6_
  - [ ] 6.2 Set up React Router v6 in `src/main.tsx` with routes for all pages
    - Routes: `/` (ProjectSelector), `/dashboard`, `/chat`, `/knowledge`, `/settings/project`, `/settings/app`
    - Redirect from `/` to `/dashboard` when `projectStore.activeProject` is set
    - _Requirements: 13.1, 13.4_
  - [ ] 6.3 Create Zustand `projectStore` in `src/store/projectStore.ts`
    - Implement `activeProject`, `projects`, `setActiveProject`, `loadProjects` as per the design
    - `setActiveProject` resets all per-project stores
    - _Requirements: 2.3, 13.4_
  - [ ]* 6.4 Write unit tests for Sidebar and routing
    - Test navigation links render correct icons, Switch Project clears active project
    - _Requirements: 13.5, 13.6_

- [ ] 7. Week 1 checkpoint
  - Ensure all tests pass, the app launches to Project Selector, a project can be created and opened, and the Sidebar navigation renders correctly. Ask the user if any questions arise.

---

### Week 2 — File Mirror + Context Builder

- [ ] 8. Implement File Watcher (`electron/fileWatcher.ts`)
  - [ ] 8.1 Create `FileWatcher` class wrapping chokidar with initial scan and per-file debounce (500 ms)
    - Constructor accepts `projectId`, `folderPath`, `ignorePatterns`
    - `start()` performs recursive scan, writes each file to `project_files` via `db.ts`, resolves with `InitialScanResult` (file count, skip count, completedAt)
    - `stop()` closes the watcher within 1 second
    - `updateIgnorePatterns(patterns)` re-applies patterns without restarting
    - Applies default ignore list and user patterns to all events
    - Sends `files:changed` IPC event to renderer after each DB write
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12_
  - [ ]* 8.2 Write property test for file ignore filter invariant (Property 8)
    - **Property 8: File ignore filter invariant**
    - **Validates: Requirements 3.6, 3.7**
  - [ ]* 8.3 Write property test for file scan count equals non-ignored files (Property 7)
    - **Property 7: File scan count equals non-ignored files on disk**
    - **Validates: Requirements 3.1, 3.6, 17.5**
  - [ ]* 8.4 Write integration tests for File Watcher end-to-end
    - Create temp dir, create project, verify scan → DB sync → update events
    - Test debounce: 10 rapid changes produce 1 DB write after 500 ms
    - Test folder deletion while watching triggers `files:folderUnavailable` IPC
    - _Requirements: 3.1, 3.3, 3.8, 3.11_

- [ ] 9. Implement Import Scanner (`electron/importScanner.ts`)
  - [ ] 9.1 Create stateless `scanFile(content, filePath, projectRoot): string[]` function
    - Two regex passes: ES module imports and CommonJS require()
    - Resolve `./` and `../` imports to absolute paths via `path.resolve`
    - Prefix non-relative imports with `"unresolved:"`
    - On parse failure return `[]` and log a warning without throwing
    - Wire into `FileWatcher` so it runs after each file DB write; writes result to `project_files.imports`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.7, 4.8_
  - [ ]* 9.2 Write property test for import scanner determinism (Property 9)
    - **Property 9: Import scanner determinism**
    - **Validates: Requirements 17.4, 17.9**
  - [ ]* 9.3 Write property test for relative import path resolution (Property 10)
    - **Property 10: Relative import path resolution**
    - **Validates: Requirements 4.3**
  - [ ]* 9.4 Write property test for non-relative imports recorded as unresolved (Property 11)
    - **Property 11: Non-relative imports recorded as unresolved**
    - **Validates: Requirements 4.4, 4.7**

- [ ] 10. Implement Context Builder engine (`electron/contextBuilder.ts`)
  - [ ] 10.1 Implement pure `assembleContext(input: AssembleContextInput): string`
    - Smart_Auto_Mode: active file + 1-level imports + files changed in last 30 min + checked Knowledge Cards
    - Selected_Files_Mode: only explicitly checked files + checked cards
    - Full_Project_Mode: folder structure tree + all non-ignored files
    - Section order: Folder Structure → Active File → Imported Files → Recently Changed Files → Knowledge Cards → User Question
    - Omit empty sections entirely; separate adjacent sections with one blank line
    - Deduplicate file paths across all selection sources
    - Wrap each file in a fenced code block labelled with its project-relative path
    - Truncate Smart_Auto_Mode output per `maxTokens` in priority order (Active File first retained)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.10, 6.11, 6.12, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_
  - [ ]* 10.2 Write property test for context assembly idempotence (Property 13)
    - **Property 13: Context assembly idempotence**
    - **Validates: Requirements 17.3**
  - [ ]* 10.3 Write property test for section order and empty-section omission (Property 14)
    - **Property 14: Context block section order and empty-section omission**
    - **Validates: Requirements 6.7, 16.1, 16.2**
  - [ ]* 10.4 Write property test for file deduplication (Property 15)
    - **Property 15: Context file deduplication invariant**
    - **Validates: Requirements 17.10**
  - [ ]* 10.5 Write property test for context block prepend format (Property 16)
    - **Property 16: Context block prepend format**
    - **Validates: Requirements 6.10, 16.4**
  - [ ]* 10.6 Write property test for file code block labeling (Property 17)
    - **Property 17: File code block labeling**
    - **Validates: Requirements 16.3**
  - [ ]* 10.7 Write property test for UTF-8 validity (Property 21)
    - **Property 21: Context output UTF-8 validity**
    - **Validates: Requirements 16.5**
  - [ ]* 10.8 Write property test for Selected Files Mode exclusivity (Property 22)
    - **Property 22: Selected Files Mode exclusivity**
    - **Validates: Requirements 6.4**
  - [ ]* 10.9 Write property test for Full Project Mode respect ignore list (Property 23)
    - **Property 23: Full Project Mode respect ignore list**
    - **Validates: Requirements 6.5, 6.6**

- [ ] 11. Implement Token Estimator (`electron/tokenEstimator.ts`)
  - [ ] 11.1 Create `estimateTokens(text: string): number` using 4 chars-per-token approximation
    - Wire into `context.estimateTokens` IPC handler
    - _Requirements: 15.1_
  - [ ]* 11.2 Write property test for token estimation accuracy (Property 20)
    - **Property 20: Token estimation accuracy**
    - **Validates: Requirements 15.1, 17.8**

- [ ] 12. Build Context Panel UI (`src/components/ContextPanel.tsx`)
  - [ ] 12.1 Implement `ContextPanel` (260 px right panel on Chat screen)
    - Mode selector: Smart / Selected / Full radio buttons
    - File tree with checkboxes (drives `contextStore.checkedFileIds`)
    - Knowledge card checklist (drives `contextStore.checkedCardIds`)
    - Live token estimate that updates within 200 ms on selection changes via `window.api.context.estimateTokens`
    - Overflow warning banner when token count exceeds 80% of provider's context window limit
    - _Requirements: 6.8, 6.9, 15.2, 15.3, 15.4_
  - [ ] 12.2 Create Zustand `contextStore` in `src/store/contextStore.ts`
    - Implement `mode`, `checkedFileIds`, `checkedCardIds`, `assembledContext`, `tokenEstimate` state
    - `setMode`, `toggleFile`, `toggleCard`, `assemble` actions
    - Debounce token estimate updates to stay within 200 ms budget
    - _Requirements: 6.8, 6.11_
  - [ ]* 12.3 Write unit tests for ContextPanel token warning threshold
    - Test warning banner appears at 80% threshold and is absent at 79%
    - _Requirements: 15.3_

- [ ] 13. Week 2 checkpoint
  - Ensure all tests pass, file watcher syncs a real folder, import scanner resolves imports, context assembly produces correctly ordered output with no empty sections, and the Context Panel renders live token counts. Ask the user if any questions arise.

---

### Week 3 — AI Webviews + VS Code Extension

- [ ] 14. Implement WebSocket server (`electron/wsServer.ts`)
  - [ ] 14.1 Create `WsServer` class managing the `ws` server on port 54321
    - `start()` / `stop()` lifecycle; `getStatus()` returns `'connected' | 'disconnected'`
    - Handle `active-file` message: prefix-match to project, set `is_active = 1` for matched file, `is_active = 0` for all others in that project; silently discard unmatched paths
    - Handle `file-saved` message: trigger FileWatcher re-read for that path
    - Reject connections when no project is open with message `"No project currently open"`
    - Expose `onActiveFileChange` and `onFileSaved` callback hooks
    - Push `ws:status` IPC event to renderer on connect/disconnect
    - _Requirements: 5.4, 5.5, 5.8, 5.9, 11.5_
  - [ ]* 14.2 Write property test for active-file routing by folder prefix (Property 12)
    - **Property 12: Active-file routing by folder prefix**
    - **Validates: Requirements 5.4, 5.5**
  - [ ]* 14.3 Write integration test for WS server routing
    - Start WS server, connect mock client, send `active-file` events, verify `is_active` flags in DB
    - _Requirements: 5.4, 5.5_

- [ ] 15. Implement Webview Manager and provider adapters (`electron/webviewManager.ts`)
  - [ ] 15.1 Create `WebviewManager` class managing `BrowserView` instances keyed by `accountId`
    - `show(accountId, bounds)` / `hide(accountId)` / `destroy(accountId)` lifecycle methods
    - `destroyPartition(partition)` clears session data from disk
    - Session partition format: `persist:{model}-{accountId}`
    - _Requirements: 7.1, 7.2, 7.3, 8.3_
  - [ ] 15.2 Implement per-provider adapter registry with `ProviderAdapter` interface
    - Adapters for Claude, ChatGPT, Gemini, Grok with `url`, `inputSelector`, `messageSelector`, `injectScript`, `overlayScript`
    - Each adapter is independent so DOM changes in one do not affect others
    - _Requirements: 7.7_
  - [ ] 15.3 Implement `injectContext(accountId, contextBlock): Promise<InjectionResult>`
    - Execute `injectScript` via `executeJavaScript`; on failure copy to clipboard and show notification
    - _Requirements: 7.5, 7.6_
  - [ ] 15.4 Implement "⭐ Save to Knowledge" overlay injection via `overlayScript`
    - Inject overlay button into each AI response message in the Webview DOM
    - Button click sends text content to main process via `postMessage` bridge for Knowledge Card creation
    - On injection failure, surface fallback button in App UI adjacent to Webview
    - _Requirements: 7.8, 7.9, 7.12_
  - [ ]* 15.5 Write integration tests for context injection
    - Mock BrowserView, verify `executeJavaScript` called with correct payload
    - Verify clipboard fallback when injection fails
    - _Requirements: 7.5, 7.6_
  - [ ]* 15.6 Write integration test for account session isolation
    - Create two accounts for same provider, verify session partitions are distinct
    - _Requirements: 7.3, 8.4_

- [ ] 16. Build Dashboard screen (`src/pages/Dashboard.tsx`) and AccountCard component
  - [ ] 16.1 Create `src/pages/Dashboard.tsx`
    - One `AccountCard` per provider (Claude, ChatGPT, Gemini, Grok) showing all AI_Accounts for that provider
    - Project mirror status section: watched folder_path, file count, last sync time (or "Never")
    - Knowledge Card count and chat count for the current project
    - Warning indicator when folder is inaccessible or watcher is inactive
    - Subscribes to `files:changed` and `ws:status` IPC events for live updates (update within 1 second)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_
  - [ ] 16.2 Create `src/components/AccountCard.tsx`
    - Lists accounts with active indicator; "Add Account" button when no accounts exist for a provider
    - Calls `window.api.accounts.add`, `window.api.accounts.setActive`, `window.api.accounts.remove`
    - Duplicate session partition error handling (Req 8.4)
    - _Requirements: 8.1, 8.2, 8.5, 8.6, 8.7, 8.8, 8.9_
  - [ ] 16.3 Create Zustand `accountStore` in `src/store/accountStore.ts`
    - Global store (not reset on project switch): `accounts`, `loadAccounts`, `addAccount`, `removeAccount`, `setActive`
    - _Requirements: 8.2_
  - [ ]* 16.4 Write unit tests for AccountCard
    - Test active indicator toggle, duplicate account error display, "Add Account" empty state
    - _Requirements: 8.4, 8.5, 8.9_

- [ ] 17. Build Chat screen (`src/pages/Chat.tsx`) with Webview integration
  - [ ] 17.1 Create `src/pages/Chat.tsx` (3-column layout: chat sidebar / webview area / ContextPanel)
    - Left sidebar lists chats for the current project grouped by provider model, sorted by `created_at` DESC
    - Empty-state message per model group when no chats exist
    - "New Chat" button creates a chat row via `window.api.chats.create`
    - ModelSwitcher dropdown in header for switching providers/accounts
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  - [ ] 17.2 Wire Webview area to `WebviewManager` via IPC
    - On chat selection: call `webview.show(accountId, bounds)` / `webview.hide` for inactive accounts
    - Restore scroll position and input content when returning to a previously visited Chat screen
    - Display error message in webview area when provider URL is unavailable
    - _Requirements: 7.4, 7.11, 9.5_
  - [ ] 17.3 Implement `SwitchContextModal` component (`src/components/SwitchContextModal.tsx`)
    - Shows assembled context preview, token count, warning banner at >80% of target provider's window limit
    - User confirms before context is injected into the new provider's input
    - _Requirements: 7.10, 15.5, 15.6_
  - [ ] 17.4 Implement context injection flow
    - Assemble context via `window.api.context.assemble`, display in SwitchContextModal, then call `window.api.webview.injectContext` on confirm
    - _Requirements: 7.5, 7.6, 7.10_
  - [ ]* 17.5 Write unit tests for Chat screen
    - Test sidebar renders grouped chats, empty state per model, new chat creation
    - _Requirements: 9.2, 9.3, 9.6_

- [ ] 18. Build VS Code extension (`vscode-extension/`)
  - [ ] 18.1 Scaffold VS Code extension with `package.json` activation events and `extension.ts` entry point
    - Activation event: `onStartupFinished`
    - Extension ID, display name, and publisher in `package.json`
    - _Requirements: 5.1_
  - [ ] 18.2 Implement `wsClient.ts` — WebSocket client with 5-second auto-reconnect
    - Connect to `ws://localhost:54321` on activation
    - Retry every 5 seconds on failure or disconnect
    - Expose `send(message)` and `onStatusChange(cb)` methods
    - _Requirements: 5.1, 5.6_
  - [ ] 18.3 Implement `fileWatcher.ts` inside the extension — VS Code event listeners
    - Listen to `vscode.window.onDidChangeActiveTextEditor`: send `{ type: 'active-file', path }` within 200 ms
    - Listen to `vscode.workspace.onDidSaveTextDocument`: send `{ type: 'file-saved', path }` within 200 ms
    - _Requirements: 5.2, 5.3_
  - [ ] 18.4 Add status bar item showing "SaKAi Hub: Connected" / "SaKAi Hub: Disconnected"
    - Update on each `wsClient` status change event
    - _Requirements: 5.7_
  - [ ]* 18.5 Write unit tests for the VS Code extension
    - Mock `vscode` API, verify events fire within 200 ms, verify status bar updates
    - _Requirements: 5.2, 5.3, 5.7_

- [ ] 19. Week 3 checkpoint
  - Ensure all tests pass. A real AI provider webview loads in the Chat screen, context can be injected (or falls back to clipboard), the WS server routes active-file events correctly, and the VS Code extension connects and updates its status bar. Ask the user if any questions arise.

---

### Week 4 — Knowledge Base + Settings + Polish

- [ ] 20. Build Knowledge Base screen and Knowledge Card components
  - [ ] 20.1 Create `src/pages/KnowledgeBase.tsx` with card grid, search, and category filter
    - Displays all Knowledge Cards for the current project: content, source_model, tags, category
    - Search field filters by content, tags, and category on each keystroke (results within 200 ms)
    - Category filter dropdown
    - Multi-select mode: select multiple cards and trigger bulk inject into Context Panel
    - "Add Card" form: non-empty content (max 10,000 chars), optional category and tags
    - Delete card with confirmation prompt
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_
  - [ ] 20.2 Create `src/components/KnowledgeCard.tsx`
    - Category pill, tags, source model badge, content preview (truncated), delete action
    - _Requirements: 10.4_
  - [ ] 20.3 Create Zustand `knowledgeStore` in `src/store/knowledgeStore.ts`
    - `cards`, `searchQuery`, `filterCategory`, `loadCards`, `createCard`, `deleteCard`, `search`
    - Per-project store; reset on project switch
    - _Requirements: 10.1, 10.2, 10.3, 10.8_
  - [ ] 20.4 Implement Knowledge Card DB helpers in `electron/db.ts`: `listCards`, `createCard`, `deleteCard`, `searchCards`
    - `searchCards` matches query against content, tags, and category; returns within 200 ms
    - _Requirements: 10.1, 10.5, 10.8, 10.9, 10.10_
  - [ ]* 20.5 Write property test for knowledge card content round-trip identity (Property 18)
    - **Property 18: Knowledge card content round-trip identity**
    - **Validates: Requirements 17.2, 10.1**
  - [ ]* 20.6 Write property test for knowledge card deletion consistency (Property 19)
    - **Property 19: Knowledge card deletion consistency**
    - **Validates: Requirements 17.7, 10.8**
  - [ ]* 20.7 Write unit tests for KnowledgeBase screen
    - Test search filtering, category filter, multi-select inject, delete confirmation, add form validation
    - _Requirements: 10.3, 10.5, 10.6, 10.7, 10.8_

- [ ] 21. Build Project Settings screen (`src/pages/ProjectSettings.tsx`)
  - [ ] 21.1 Implement `src/pages/ProjectSettings.tsx`
    - Display and edit `folder_path` via folder picker; on save: stop old watcher, update DB, start new watcher
    - Display and edit Ignore List (default + custom patterns); persist to `project_settings.ignore_patterns`, apply immediately
    - Display VS Code extension connection status ("Connected" / "Disconnected")
    - Context defaults: `default_context_mode`, `auto_include_active_file` toggle, `max_auto_context_tokens` integer field
    - Warn on unsaved-changes navigation attempt
    - Atomic save: all fields persisted in one transaction before navigation
    - Danger zone: "Delete Project" requiring confirmation button; on confirm: delete project + all per-project data, navigate to Project Selector
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10_
  - [ ]* 21.2 Write unit tests for ProjectSettings
    - Test folder change triggers watcher restart, ignore pattern applied immediately, unsaved-changes guard, delete flow
    - _Requirements: 11.2, 11.4, 11.7, 11.8, 11.9, 11.10_

- [ ] 22. Build App Settings screen (`src/pages/AppSettings.tsx`) and global theme
  - [ ] 22.1 Implement `src/pages/AppSettings.tsx`
    - Dark/light theme toggle; apply globally within 300 ms via CSS custom properties or Tailwind dark mode class
    - Persist selected theme to `app_settings` table on change
    - Step-by-step VS Code extension installation instructions
    - Display app version in MAJOR.MINOR.PATCH format read from `package.json`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_
  - [ ]* 22.2 Write unit tests for AppSettings
    - Test theme toggle applies class change within 300 ms, version string format
    - _Requirements: 12.3, 12.5_

- [ ] 23. Wire Save-to-Knowledge overlay and Knowledge Card multi-select inject
  - [ ] 23.1 Complete `saveKnowledgeFromWebview` IPC handler in `electron/main.ts`
    - Receive `SaveKnowledgePayload` from preload postMessage bridge
    - Validate content is non-empty; persist as Knowledge Card scoped to current `project_id`
    - On empty content or DB failure: return error, do not create card; renderer shows error notification
    - _Requirements: 7.8, 7.9, 10.2, 10.10_
  - [ ] 23.2 Wire Knowledge Card multi-select bulk inject in `KnowledgeBase.tsx`
    - Selected cards joined with horizontal rules, pushed into `contextStore.checkedCardIds` / assembled context
    - _Requirements: 10.7, 6.9_
  - [ ]* 23.3 Write unit tests for Save-to-Knowledge flow
    - Test empty content rejection, successful save, DB error notification path
    - _Requirements: 7.9, 10.10_

- [ ] 24. Implement empty states and error handling across all screens
  - [ ] 24.1 Add empty state UI to Project Selector (no projects yet), Dashboard (no accounts), Chat (no chats), Knowledge Base (no cards)
    - Each empty state includes a contextual call-to-action button
    - _Requirements: 8.9, 9.6, 13.3_
  - [ ] 24.2 Implement global toast notification system for IPC errors
    - Render `IpcError` responses as dismissible toast notifications
    - Handle all error codes: `VALIDATION`, `NOT_FOUND`, `DUPLICATE`, `DB_ERROR`, `FS_ERROR`, `INJECTION_FAILED`
    - _Requirements: 1.7, 1.8, 2.7, 3.11, 7.6, 8.4, 10.10_
  - [ ] 24.3 Handle project switch timing and partial-load error state
    - If project switch takes > 3 seconds or FileWatcher fails to start, display error and navigate to Project Selector
    - _Requirements: 2.4, 2.7_
  - [ ]* 24.4 Write integration test for project switch timing
    - Switch between two projects with populated data, verify completion within 3 seconds
    - _Requirements: 2.4_

- [ ] 25. Configure electron-builder packaging
  - [ ] 25.1 Add `electron-builder` configuration to `package.json` for macOS, Windows, and Linux targets
    - Configure `appId`, `productName`, `directories.output`, and platform-specific targets (dmg, nsis, AppImage)
    - Add `build` script: `electron-builder --publish never`
    - Include VS Code extension `.vsix` artifact in `extraResources` if pre-built
    - _Requirements: overall deployment_
  - [ ]* 25.2 Verify production build compiles without errors
    - Run `npm run build` and confirm output artifacts exist for at least one target platform
    - _Requirements: overall deployment_

- [ ] 26. Final checkpoint — full integration pass
  - Ensure all tests pass. Verify end-to-end: create project → file sync → context assembly → webview injection → save to knowledge → knowledge inject → project settings save → theme toggle → packaged build succeeds. Ask the user if any questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; core functionality tasks must be completed in order.
- Each task references specific requirements for traceability. Requirement numbers map to the `requirements.md` document.
- Property test tasks (e.g., 2.2, 9.2) map 1-to-1 with Correctness Properties in `design.md`; use **fast-check** with `{ numRuns: 100 }` and tag each test with `// Feature: sakai-hub, Property N: Title`.
- Unit tests and integration tests use **vitest** with `environment: 'node'`; configure in `vitest.config.ts`.
- Checkpoints (tasks 7, 13, 19, 26) are not coding tasks — they are integration validation gates.
- All database operations must pass `PRAGMA foreign_keys = ON` and use parameterised queries.
- The VS Code extension lives in a sibling directory (`vscode-extension/`) with its own `package.json`.

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "2.2", "2.3", "2.4", "3.1"] },
    { "id": 2, "tasks": ["3.2", "4.1"] },
    { "id": 3, "tasks": ["3.3", "4.2", "4.3", "4.4", "4.5", "5.1", "6.2", "6.3"] },
    { "id": 4, "tasks": ["5.2", "6.1", "6.4", "8.1"] },
    { "id": 5, "tasks": ["8.2", "8.3", "8.4", "9.1", "11.1"] },
    { "id": 6, "tasks": ["9.2", "9.3", "9.4", "10.1", "11.2"] },
    { "id": 7, "tasks": ["10.2", "10.3", "10.4", "10.5", "10.6", "10.7", "10.8", "10.9", "12.2", "14.1"] },
    { "id": 8, "tasks": ["12.1", "12.3", "14.2", "14.3", "15.1"] },
    { "id": 9, "tasks": ["15.2", "16.3", "18.1"] },
    { "id": 10, "tasks": ["15.3", "15.4", "16.1", "16.2", "18.2", "18.3"] },
    { "id": 11, "tasks": ["15.5", "15.6", "17.1", "18.4", "20.4"] },
    { "id": 12, "tasks": ["16.4", "17.2", "17.3", "18.5", "20.1", "20.3"] },
    { "id": 13, "tasks": ["17.4", "17.5", "20.2", "20.5", "20.6", "21.1", "22.1"] },
    { "id": 14, "tasks": ["20.7", "21.2", "22.2", "23.1", "24.1", "24.2", "24.3"] },
    { "id": 15, "tasks": ["23.2", "23.3", "24.4", "25.1"] },
    { "id": 16, "tasks": ["25.2"] }
  ]
}
```
