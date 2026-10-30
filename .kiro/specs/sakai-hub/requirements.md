# Requirements Document

## Introduction

SaKAi Hub is a multi-workspace AI development environment built as a local-first Electron desktop application. It keeps every software project synchronized with a live local mirror, maintains persistent project knowledge independent of any AI provider, and lets developers switch between AI assistants (Claude, ChatGPT, Gemini, Grok) without losing context or re-uploading code.

The system eliminates the repeated "re-teach the AI about my project" workflow by providing: persistent per-project file mirroring via chokidar, a three-mode Context Builder that assembles exactly the right code context, a Knowledge Base of saved AI responses (Knowledge Cards), and isolated browser sessions per AI account.

AI provider accounts (the Gmail/login sessions for Claude, ChatGPT, Gemini, and Grok) are **global** — connected once and shared across all projects. Project isolation applies strictly to the three things that are genuinely project-specific: the file mirror, Knowledge Cards, and chat history. Conversation separation between projects is handled by each provider's own native Projects feature inside their webview; SaKAi Hub does not automate this.

---

## Glossary

- **App**: The SaKAi Hub Electron desktop application.
- **Project**: A user-defined workspace that maps one-to-one with a local folder on disk and contains its own file mirror, Knowledge Cards, and chat history.
- **Project_Selector**: The entry-point screen listing all user projects.
- **Dashboard**: The global screen showing AI provider account connections and, when a Project is open, that project's mirror status.
- **Chat_Screen**: The per-project, per-model screen that embeds the AI provider's website.
- **Knowledge_Base**: The per-project screen for managing Knowledge Cards.
- **Project_Settings**: The per-project configuration screen.
- **App_Settings**: The global application configuration screen.
- **File_Watcher**: The chokidar-based component that monitors a project folder for file system changes.
- **Import_Scanner**: The regex-based component that parses JS/TS/JSX/TSX import statements to build a file dependency graph.
- **Context_Builder**: The engine that assembles context blocks from project files and Knowledge Cards for injection into AI chat inputs.
- **Context_Panel**: The right-side UI panel on the Chat Screen where users select context items.
- **Knowledge_Card**: A saved AI response or manual note, scoped to a project, with content, category, tags, and source metadata.
- **Provider**: One of the four supported AI services: Claude (claude.ai), ChatGPT (chatgpt.com), Gemini (gemini.google.com), or Grok (grok.com).
- **AI_Account**: A globally stored user account for a specific Provider, with an isolated browser session partition. AI_Accounts are not scoped to any Project — they are connected once and available across all Projects.
- **Webview**: An Electron BrowserView instance rendering a Provider's website in an isolated session.
- **Session_Partition**: An Electron session identifier in the format `persist:{model}-{accountId}` that provides cookie and storage isolation per AI_Account.
- **Switch_Context_Modal**: The dialog that previews token count and injects context when switching between Providers.
- **VS_Code_Extension**: The companion VS Code extension that communicates with the App over WebSocket.
- **WS_Server**: The WebSocket server running inside the App on port 54321 that receives events from the VS_Code_Extension.
- **Active_File**: The file currently focused in the VS Code editor, tracked via VS_Code_Extension events.
- **Token_Estimator**: The component that calculates approximate token counts for assembled context blocks.
- **Smart_Auto_Mode**: Context_Builder mode 1 — automatically selects the active file, its 1-level imports, recently changed files, and checked Knowledge Cards.
- **Selected_Files_Mode**: Context_Builder mode 2 — only files explicitly checked by the user.
- **Full_Project_Mode**: Context_Builder mode 3 — complete folder structure plus all source file contents respecting the ignore list.
- **Ignore_List**: The combined set of default-ignored paths (node_modules/, .git/, dist/, build/, .next/, out/, coverage/, *.log, .DS_Store) plus user-defined custom patterns.
- **Import_Graph**: The directed graph of file-to-file import relationships built by the Import_Scanner.
- **project_id**: The unique identifier (UUID) of a Project, used as a foreign key in every per-project database table.
- **SQLite_DB**: The local SQLite database file managed by better-sqlite3 storing all application state.

---

## Requirements

### Requirement 1: Project Creation and Management

**User Story:** As a developer, I want to create and manage multiple isolated projects, so that I can keep each codebase's file context, Knowledge Cards, and chat history completely separate.

#### Acceptance Criteria

1. THE App SHALL store each Project with a unique project_id (UUID), a name between 1 and 100 characters, a folder_path, a created_at timestamp, and a last_opened_at timestamp in the SQLite_DB.
2. WHEN a user creates a new Project, THE App SHALL require a name between 1 and 100 characters and a valid existing folder_path before persisting the Project.
3. WHEN a new Project is created, THE App SHALL record created_at and last_opened_at as the current UTC timestamp.
4. WHEN a user opens an existing Project, THE App SHALL update the Project's last_opened_at to the current UTC timestamp.
5. THE Project_Selector SHALL display all Projects sorted by last_opened_at descending.
6. WHEN a user deletes a Project, THE App SHALL execute the removal of all associated database rows (project_files, chats, knowledge_cards, project_settings) as a single atomic transaction and SHALL NOT modify any files on disk and SHALL NOT delete any AI_Account rows (accounts are global).
7. IF a user attempts to create a Project with a folder_path that does not exist on disk, THEN THE App SHALL display an error message and SHALL NOT persist the Project.
8. IF a user attempts to create a Project with a name that is empty or exceeds 100 characters, THEN THE App SHALL display a validation error and SHALL NOT persist the Project.
9. THE App SHALL support a minimum of 50 simultaneously stored Projects in the SQLite_DB.
10. IF a user opens an existing Project whose folder_path no longer exists on disk, THEN THE App SHALL display an error message and SHALL NOT start the File_Watcher.
11. WHEN a user renames a Project, THE App SHALL update the Project's name in the projects table and display the new name in the Project_Selector immediately.

---

### Requirement 2: Project Isolation

**User Story:** As a developer, I want each project's files, knowledge, and chat history to be completely isolated, so that switching projects never shows me context, knowledge cards, or chats from a different codebase.

#### Acceptance Criteria

1. THE SQLite_DB SHALL enforce a project_id foreign key on every row in the project_files, chats, knowledge_cards, and project_settings tables. AI_Accounts SHALL NOT carry a project_id foreign key as they are global.
2. WHEN the App queries project_files, chats, knowledge_cards, or project_settings, THE App SHALL include a project_id filter on every query without exception.
3. WHEN a user switches Projects, THE App SHALL ensure that no file mirror data, Knowledge Cards, or chat history from the previous Project is visible in any screen of the newly loaded Project.
4. WHEN a user switches Projects, THE App SHALL complete unloading of the previous Project and begin loading the new Project within 3 seconds, where "loaded" is observable as: the new Project's name appears in the sidebar, the Dashboard displays the new Project's file count, and the Context_Panel shows the new Project's files.
5. WHEN a user attempts to view any per-project screen, THE App SHALL only display data whose project_id matches the currently active Project's project_id.
6. WHEN a Project is deleted, THE App SHALL cascade-delete all rows in project_files, chats, knowledge_cards, and project_settings where project_id matches the deleted Project's project_id; IF the cascade delete fails for any table, THEN THE App SHALL display an error and leave all data intact. AI_Account rows SHALL remain untouched.
7. IF the App encounters an error while switching Projects (e.g., File_Watcher fails to start), THEN THE App SHALL display an error message and navigate to the Project_Selector rather than showing a partially loaded state.

---

### Requirement 3: File Mirror and Synchronization

**User Story:** As a developer, I want my project folder mirrored automatically and continuously, so that the App always has an up-to-date snapshot of my code regardless of how I edit it.

#### Acceptance Criteria

1. WHEN a new Project is created, THE File_Watcher SHALL perform an initial recursive scan of the project folder_path, storing each discovered file's path, content, and last_modified timestamp in the project_files table.
2. WHILE a Project is open, THE File_Watcher SHALL watch the project folder_path recursively using chokidar for add, change, and unlink events.
3. WHEN a file change event is received, THE File_Watcher SHALL debounce updates by 500 milliseconds before writing the updated content to the SQLite_DB.
4. WHEN a file is added to the watched folder, THE File_Watcher SHALL insert a new row into project_files with the file's path, content, and last_modified.
5. WHEN a file is deleted from the watched folder, THE File_Watcher SHALL remove the corresponding row from project_files.
6. THE File_Watcher SHALL apply the Ignore_List to all events and SHALL NOT store or track files matching any pattern in the Ignore_List.
7. THE File_Watcher SHALL always ignore node_modules/, .git/, dist/, build/, .next/, out/, coverage/, files matching *.log, and .DS_Store by default.
8. WHEN a Project is closed or the user switches Projects, THE File_Watcher SHALL stop watching the current folder_path within 1 second.
9. WHEN the initial scan of a project folder completes, THE Dashboard SHALL display the total count of files stored in project_files and the timestamp at which the scan completed.
10. WHEN a file add, change, or unlink event is processed and the project_files table is updated, THE File_Watcher SHALL push an IPC update event to the renderer process so the Context_Panel reflects the current file status.
11. IF the project folder_path is deleted or becomes inaccessible while being watched, THEN THE File_Watcher SHALL stop watching and THE App SHALL display a warning indicating the folder is no longer accessible.
12. IF a file is unreadable during the initial scan (e.g., due to permissions), THEN THE File_Watcher SHALL skip that file, continue scanning remaining files, and display the count of skipped files in the Dashboard after the scan completes.

---

### Requirement 4: Import Graph Construction

**User Story:** As a developer, I want the App to understand which files my active file depends on, so that the Context_Builder can automatically include relevant imported files in my AI context.

#### Acceptance Criteria

1. THE Import_Scanner SHALL parse JS, TS, JSX, and TSX files using regex-based detection of ES module import statements and CommonJS require() calls to extract imported file paths.
2. WHEN a file is added or updated in the project_files table, THE Import_Scanner SHALL re-scan that file and update its imports field (stored as a JSON array) in the project_files table.
3. THE Import_Scanner SHALL resolve relative import paths (starting with ./ or ../) to absolute file paths within the project folder.
4. THE Import_Scanner SHALL treat imports not starting with ./ or ../ (including bare module names and non-relative aliases) as unresolvable and delegate them to the unresolved-path behavior defined in criterion 7.
5. WHEN the App starts and after each file's import field is updated, THE App SHALL rebuild the Import_Graph from all import relationships stored in project_files.imports.
6. WHEN the Active_File changes, THE Context_Builder SHALL use the Import_Graph to retrieve all files directly imported by the Active_File (1 level deep) for use in Smart_Auto_Mode.
7. IF an imported file path cannot be resolved to an existing project file, THE Import_Scanner SHALL record the unresolved path in the imports field, distinguished from resolved paths (e.g., prefixed with "unresolved:"), without causing an error.
8. IF the Import_Scanner encounters a parse failure (malformed file content) while scanning a file, THE Import_Scanner SHALL skip that file, preserve any existing imports data for that file, and continue without error.
9. WHEN any file's imports field is updated in project_files, THE App SHALL trigger a rebuild of the Import_Graph.

---

### Requirement 5: VS Code Extension — Active File Tracking

**User Story:** As a developer, I want the App to know which file I have open in VS Code, so that the Context_Builder can automatically include the most relevant file in my AI context.

#### Acceptance Criteria

1. WHEN the VS Code extension activation event fires, THE VS_Code_Extension SHALL attempt to establish a WebSocket connection to the WS_Server at ws://localhost:54321.
2. WHEN the focused file changes in VS Code, THE VS_Code_Extension SHALL send an active-file event containing the absolute file path to the WS_Server within 200 milliseconds.
3. WHEN a file is saved in VS Code, THE VS_Code_Extension SHALL send a file-saved event containing the absolute file path to the WS_Server within 200 milliseconds.
4. WHEN the WS_Server receives an active-file event, THE App SHALL identify the Project whose folder_path is a prefix of the event's file path (using prefix-match comparison) and update the is_active flag: set is_active = true for the matching file and set is_active = false for all previously active files in that Project.
5. WHEN the WS_Server receives an active-file event for a path that does not match any stored project folder_path prefix, THE App SHALL silently discard the event without logging an error or modifying any data.
6. IF the WebSocket connection to the WS_Server is unavailable at any point (initial connection or mid-session drop), THE VS_Code_Extension SHALL retry the connection every 5 seconds until the connection is established.
7. WHEN the WebSocket connection is established, THE VS_Code_Extension SHALL update its VS Code status bar item to display "SaKAi Hub: Connected". WHEN the connection is lost or unavailable, THE VS_Code_Extension SHALL update the status bar item to display "SaKAi Hub: Disconnected".
8. THE WS_Server SHALL listen on port 54321 at all times while a Project is open and SHALL accept incoming WebSocket connections from the VS_Code_Extension.
9. WHEN the WS_Server receives a connection request while no Project is open, THE WS_Server SHALL reject the connection with a descriptive error message.

---

### Requirement 6: Context Builder Engine

**User Story:** As a developer, I want to control exactly what project context is sent to an AI model, so that I can provide relevant code without wasting tokens or sending irrelevant files.

#### Acceptance Criteria

1. THE Context_Builder SHALL support three modes: Smart_Auto_Mode, Selected_Files_Mode, and Full_Project_Mode.
2. WHEN Smart_Auto_Mode is active, THE Context_Builder SHALL include: the Active_File's full content, all files 1 level deep in the Import_Graph from the Active_File, all project files with a last_modified timestamp within the last 30 minutes, and all currently checked Knowledge Cards.
3. IF Smart_Auto_Mode is active and no Active_File is set, THEN THE Context_Builder SHALL omit the Active_File and Imported Files sections from the output without error.
4. IF Selected_Files_Mode is active, THEN THE Context_Builder SHALL include only the files and Knowledge Cards explicitly checked by the user in the Context_Panel.
5. IF Full_Project_Mode is active, THEN THE Context_Builder SHALL include the complete folder structure as a text tree and the full content of all project files not in the Ignore_List.
6. WHILE Full_Project_Mode is active, THE Context_Builder SHALL omit all files matching any pattern in the Ignore_List from the content output.
7. THE Context_Builder SHALL produce output as a structured text block with clearly labeled sections in this order: Folder Structure, Active File, Imported Files, Recently Changed Files, Knowledge Cards, User Question; sections with no available content SHALL be omitted entirely from the output.
8. WHILE the user is modifying context selections in the Context_Panel, THE Token_Estimator SHALL calculate and display a live token estimate that updates within 200 milliseconds.
9. IF Full_Project_Mode is active, THEN THE App SHALL display the token estimate in the Context_Panel header and SHALL display an inline warning message adjacent to the token estimate if the estimated token count exceeds the selected Provider's context window limit.
10. THE Context_Builder SHALL prepend the structured context block to the user's message before injection into the Webview.
11. THE project_settings table SHALL store a default_context_mode, an auto_include_active_file boolean, and a max_auto_context_tokens value per Project, and THE Context_Builder SHALL respect these settings as defaults.
12. WHERE a user has set max_auto_context_tokens, THE Context_Builder SHALL truncate Smart_Auto_Mode context to stay within that limit, applying truncation in priority order: Active_File content first retained, then Imported Files, then Recently Changed Files, then Knowledge Cards.

---

### Requirement 7: AI Provider Webviews

**User Story:** As a developer, I want to use Claude, ChatGPT, Gemini, and Grok through their actual web interfaces inside the App, so that I get full provider functionality without a separate browser.

#### Acceptance Criteria

1. THE App SHALL render a dedicated Electron BrowserView (Webview) for each AI_Account using a Session_Partition in the format `persist:{model}-{accountId}`.
2. THE App SHALL support the following Provider URLs: claude.ai for Claude, chatgpt.com for ChatGPT, gemini.google.com for Gemini, and grok.com for Grok.
3. WHEN a user adds a new AI_Account for a Provider, THE App SHALL create a new Session_Partition ensuring that the new account's cookies and storage are fully isolated from all other AI_Accounts.
4. WHEN a user switches between AI_Accounts for the same Provider, THE App SHALL load the Webview with the selected account's Session_Partition.
5. WHEN the Context_Builder assembles a context block, THE App SHALL inject it into the Provider's chat input box via executeJavaScript targeting the Provider's input DOM element.
6. IF context injection via executeJavaScript fails for a Provider, THEN THE App SHALL copy the context block to the system clipboard and display a notification to the user with instructions to paste manually.
7. THE App SHALL use a per-Provider adapter pattern so that DOM selector changes for one Provider do not affect injection logic for other Providers.
8. THE App SHALL render an overlay button labeled "⭐ Save to Knowledge" on each AI response message within the Webview DOM.
9. WHEN a user clicks the "⭐ Save to Knowledge" button on an AI response, THE App SHALL extract the message's text content and transmit it to the main process via the preload/postMessage bridge for storage as a Knowledge_Card; IF the extracted text is empty or the extraction fails, THEN THE App SHALL display an error notification and SHALL NOT create a Knowledge_Card.
10. WHEN a user switches to a different Provider from the Chat_Screen, THE Switch_Context_Modal SHALL display the assembled context block preview and token estimate in tokens before the user confirms injection.
11. WHEN a user navigates away from a Chat_Screen and returns to the same Chat_Screen within the same App process lifecycle, THE App SHALL restore the Webview's scroll position and input content to the state at the time of navigation.
12. IF the "⭐ Save to Knowledge" overlay button injection fails for a Provider (e.g., DOM mutation prevents injection), THEN THE App SHALL display a fallback "Save to Knowledge" button within the App's own UI adjacent to the Webview and SHALL NOT silently lose the save capability.

---

### Requirement 8: AI Account Management

**User Story:** As a developer, I want to connect my AI provider accounts once globally and switch between multiple accounts per provider when one hits a usage limit, so that all my projects can use the same accounts without re-configuring each project.

#### Acceptance Criteria

1. THE Dashboard SHALL display a card for each of the four Providers (Claude, ChatGPT, Gemini, Grok) showing all globally stored AI_Accounts for that Provider.
2. AI_Accounts SHALL be stored in the ai_accounts table without a project_id foreign key, making them available across all Projects in the App.
3. WHEN a user adds an AI_Account, THE App SHALL store a model name of up to 100 characters, a user-provided label of up to 50 characters, the Session_Partition identifier, and an is_active flag in the ai_accounts table.
4. IF a user attempts to add an AI_Account with a Session_Partition identifier that already exists for the same Provider, THEN THE App SHALL display an error message and SHALL NOT create a duplicate account row.
5. WHEN a user sets an AI_Account as active, THE App SHALL set is_active = true for that account and is_active = false for all other accounts of the same Provider (one active account per Provider globally at any time).
6. THE App SHALL allow a user to add multiple AI_Accounts for the same Provider.
7. WHEN a user removes a non-active AI_Account, THE App SHALL delete the account row from ai_accounts and destroy the associated Session_Partition data from disk.
8. WHEN a user removes the currently-active AI_Account for a Provider, THE App SHALL delete the account row from ai_accounts, destroy the associated Session_Partition data from disk, and leave all remaining accounts of that Provider as is_active = false (resulting in no active account for that Provider).
9. IF no AI_Account is marked active for a Provider, THE App SHALL display an "Add Account" prompt on that Provider's card on the Dashboard.

---

### Requirement 9: Chat Management

**User Story:** As a developer, I want my AI conversations organized and persistent per project and per model, so that I can find and continue previous conversations easily.

#### Acceptance Criteria

1. THE App SHALL store each chat session in the chats table with a project_id, model, account_id, title, and created_at timestamp.
2. THE Chat_Screen SHALL display a left sidebar listing all chats for the current Project, grouped by Provider model.
3. WHEN a new chat is initiated, THE App SHALL create a new row in the chats table with the current project_id, the selected model/account_id, a default title of "New Chat", and the current UTC timestamp as created_at.
4. THE App SHALL display chats in the sidebar sorted by created_at descending within each model group.
5. WHEN a user selects a chat from the sidebar, THE App SHALL navigate the Webview to the corresponding Provider URL session for that chat; IF the Provider URL is unavailable, THE App SHALL display an error message in place of the Webview.
6. IF no chats exist for a Provider model within the current Project, THE App SHALL display an empty-state message within that model's group in the sidebar.

---

### Requirement 10: Knowledge Base and Knowledge Cards

**User Story:** As a developer, I want to save important AI responses and notes to a searchable knowledge base per project, so that I can inject relevant past knowledge into future AI conversations without re-explaining things.

#### Acceptance Criteria

1. THE App SHALL store each Knowledge_Card in the knowledge_cards table with a project_id, content, category, tags (JSON array), source_model, source_chat_id, and created_at timestamp.
2. WHEN a user saves a Knowledge_Card from a Webview overlay button, THE App SHALL persist the extracted AI response text as a new Knowledge_Card in the knowledge_cards table scoped to the current project_id.
3. WHEN a user manually adds a Knowledge_Card from the Knowledge_Base screen, THE App SHALL require a non-empty content field of up to 10,000 characters, and SHALL allow the user to optionally assign a category and add tags before saving.
4. THE Knowledge_Base screen SHALL display all Knowledge_Cards for the current Project with their content, source_model, tags, and category.
5. WHEN a user types in the Knowledge_Base search field, THE App SHALL filter Knowledge_Cards by matching the query against content, tags, and category on each keystroke, returning results within 200 milliseconds.
6. THE Knowledge_Base screen SHALL allow filtering Knowledge_Cards by category.
7. WHEN a user selects multiple Knowledge_Cards via multi-select and triggers bulk injection, THE App SHALL add all selected cards to the Context_Panel as a labeled block with each card's content separated by a horizontal rule.
8. WHEN a user initiates deletion of a Knowledge_Card, THE App SHALL display a confirmation prompt; WHEN the user confirms, THE App SHALL remove the corresponding row from knowledge_cards and the card SHALL no longer appear in the Knowledge_Base or Context_Panel.
9. THE Context_Builder SHALL include only Knowledge_Cards that are currently checked in the Context_Panel when assembling a context block, with multiple checked cards separated by a horizontal rule in the assembled output.
10. IF saving a Knowledge_Card fails (e.g., database write error), THEN THE App SHALL display an error notification and SHALL NOT silently discard the content.

---

### Requirement 11: Project Settings

**User Story:** As a developer, I want to configure per-project settings including ignored paths, context defaults, and AI accounts, so that the App behaves correctly for each unique project.

#### Acceptance Criteria

1. THE Project_Settings screen SHALL display the current folder_path for the Project and allow the user to change it via a folder picker.
2. WHEN a user changes the folder_path for a Project, THE App SHALL stop the existing File_Watcher, update the folder_path in the projects table, and start a new File_Watcher for the updated path.
3. THE Project_Settings screen SHALL display the current Ignore_List and allow the user to add custom ignore patterns.
4. WHEN a user adds a custom ignore pattern, THE App SHALL persist the pattern in the project_settings.ignore_patterns JSON field and apply it to the File_Watcher immediately without requiring a restart.
5. THE Project_Settings screen SHALL display the VS_Code_Extension connection status as "Connected" or "Disconnected" for the current Project, reflecting the live WS_Server connection state.
6. THE Project_Settings screen SHALL allow the user to set default_context_mode (one of Smart_Auto_Mode, Selected_Files_Mode, Full_Project_Mode), auto_include_active_file (boolean toggle), and max_auto_context_tokens (integer field) for the current Project.
7. WHEN a user saves changes on the Project_Settings screen, THE App SHALL persist all changed fields to the project_settings table as a single atomic write before any navigation occurs.
8. THE Project_Settings screen SHALL include a "Delete Project" action in a clearly labeled danger zone section that requires the user to click a confirmation button before executing deletion.
9. WHEN a user confirms Project deletion from the danger zone, THE App SHALL delete the Project and all its associated per-project data (project_files, chats, knowledge_cards, project_settings) without modifying any files on disk and without deleting any AI_Account rows, then navigate to the Project_Selector screen.
10. WHEN the Project_Settings screen is open and the user attempts to navigate away with unsaved changes, THE App SHALL display a confirmation prompt warning that unsaved changes will be lost.

---

### Requirement 12: App Settings and Global Configuration

**User Story:** As a developer, I want global application settings for appearance and extension setup, so that I can configure the App environment once across all projects.

#### Acceptance Criteria

1. THE App SHALL store global settings as key-value pairs in the app_settings table.
2. THE App_Settings screen SHALL allow the user to switch between dark and light themes.
3. WHEN a user selects a theme, THE App SHALL apply the selected theme globally to all currently visible screens within 300 milliseconds.
4. THE App_Settings screen SHALL display step-by-step instructions for installing the VS_Code_Extension.
5. THE App_Settings screen SHALL display the current App version in MAJOR.MINOR.PATCH semantic versioning format.
6. WHEN a theme is changed, THE App SHALL persist the selected theme value to the app_settings table so that the same theme is applied on the next App launch.

---

### Requirement 13: Project Selector Screen

**User Story:** As a developer, I want a clear entry-point screen where I can see all my projects and create new ones, so that I can quickly navigate to the right workspace.

#### Acceptance Criteria

1. THE Project_Selector screen SHALL be the first screen displayed when the App launches.
2. THE Project_Selector screen SHALL list all Projects with their name, folder_path, and last_opened_at date.
3. THE Project_Selector screen SHALL display a "+ New Project" button that opens a creation form.
4. WHEN a user clicks on an existing Project from the Project_Selector, THE App SHALL load that Project and navigate to the Dashboard screen; IF loading the Project fails, THE App SHALL display an error message and remain on the Project_Selector screen.
5. THE App SHALL provide a persistent "Switch Project" control in the sidebar that is accessible from all per-project screens.
6. WHEN the "Switch Project" control is activated, THE App SHALL unload the current Project's in-memory state and navigate to the Project_Selector screen; IF the current Project has unsaved work, THE App SHALL display a confirmation prompt before unloading.
7. WHEN the new Project creation form is submitted, THE App SHALL validate that the name is between 1 and 100 characters and the folder_path exists on disk before creating the Project; IF validation fails, THE App SHALL display the specific validation error and keep the form open.

---

### Requirement 14: Dashboard Screen

**User Story:** As a developer, I want a global dashboard showing my AI provider connections and, when a project is open, that project's mirror status, so that I can manage accounts once and see the health of my current workspace at a glance.

#### Acceptance Criteria

1. THE Dashboard screen SHALL display one card per Provider (Claude, ChatGPT, Gemini, Grok) showing all globally stored AI_Accounts for that Provider including each account's label identifier.
2. THE Dashboard screen SHALL display the current Project's mirror status (when a Project is open) including the watched folder_path, the total file count in project_files, and the last sync time; IF no sync has occurred yet, THE Dashboard SHALL display "Never" for the last sync time.
3. WHEN a File_Watcher event completes a sync, THE Dashboard SHALL update the file count and last sync time within 1 second.
4. THE Dashboard screen SHALL display the count of Knowledge_Cards and the count of chats scoped to the current Project (when a Project is open).
5. IF no AI_Account exists for a Provider, THEN THE Dashboard SHALL display an "Add Account" button on that Provider's card.
6. IF the project folder_path is inaccessible or the File_Watcher is inactive, THEN THE Dashboard SHALL display a warning indicator on the mirror status section stating the folder is unavailable.

---

### Requirement 15: Token Estimation

**User Story:** As a developer, I want to see an accurate token estimate before sending context to an AI model, so that I can avoid exceeding context window limits and control my usage.

#### Acceptance Criteria

1. THE Token_Estimator SHALL calculate token counts using an approximation of 4 characters per token for all text content in the context block.
2. THE Context_Panel SHALL display the current token estimate in real time, updating within 200 milliseconds whenever the selected context items change.
3. WHEN the estimated token count exceeds 80% of the selected Provider's context window limit, THE App SHALL display a clearly labeled warning banner in the Context_Panel indicating the threshold has been exceeded.
4. IF Full_Project_Mode is active, THEN THE App SHALL display the token estimate in the Context_Panel header before the user sends a message, and SHALL block sending if the estimate exceeds 100% of the selected Provider's context window limit.
5. THE Switch_Context_Modal SHALL display the token estimate for the assembled context block before the user confirms injection.
6. WHEN the estimated token count in the Switch_Context_Modal exceeds 80% of the target Provider's context window limit, THE Switch_Context_Modal SHALL display the same warning banner as defined in criterion 3.

---

### Requirement 16: Structured Context Block Format

**User Story:** As a developer, I want the context injected into AI chat inputs to follow a consistent labeled format, so that AI models can reliably parse and use the provided project information.

#### Acceptance Criteria

1. THE Context_Builder SHALL produce context blocks with sections in the following order: `## Folder Structure`, `## Active File: {filename}`, `## Imported Files`, `## Recently Changed Files`, `## Knowledge Cards`, `## User Question`.
2. THE Context_Builder SHALL omit any section whose content is empty (no items and no text content) rather than including an empty section header.
3. THE Context_Builder SHALL label each file's content block using a fenced code block with the file's relative path within the project folder as the block label (e.g., ` ```src/pages/login.tsx `).
4. WHEN a context block is injected into a Webview, THE App SHALL prepend the block to the user's message text with a single blank line separator between the context block and the user's message.
5. THE Context_Builder SHALL produce valid UTF-8 text output that does not contain null bytes or invalid Unicode sequences.
6. WHEN the context block contains multiple sections, THE Context_Builder SHALL separate adjacent sections with a single blank line.

---

### Requirement 17: Correctness Properties

**User Story:** As a developer, I want the App's core data transformations to be reliably correct, so that I can trust that context is assembled and stored without silent data corruption.

#### Acceptance Criteria

1. FOR ALL project_files records, THE SQLite_DB SHALL ensure that the project_id foreign key references a valid row in the projects table (referential integrity invariant).
2. FOR ALL Knowledge Cards created from a Webview overlay save action, THE App SHALL ensure that the stored content is byte-for-byte identical to the raw `.textContent` of the source DOM element, with no trimming or markup transformation (round-trip identity property: extract → store → retrieve SHALL yield the original text).
3. FOR ALL context blocks assembled by the Context_Builder, given the same set of selected files and Knowledge Cards as inputs, THE Context_Builder SHALL produce a byte-identical string output on every invocation (idempotence property: assembleContext(inputs) === assembleContext(inputs) for any fixed inputs).
4. FOR ALL valid import statements in a JS/TS/JSX/TSX file, the Import_Scanner SHALL produce the same set of resolved paths when invoked on the same file content at two different points in time (cross-invocation determinism: Import_Scanner(content, t1) = Import_Scanner(content, t2) for any t1, t2).
5. WHEN the initial scan of a project folder completes, THE count of rows in project_files for that project_id SHALL equal the number of files on disk within the project folder that are not excluded by the project's active Ignore_List rules at the time the scan finished.
6. FOR ALL Knowledge_Cards, project_files, and chats retrieved from the SQLite_DB for a given project_id, the set of returned rows SHALL be a subset of the rows that were inserted with that project_id and SHALL NOT include any row inserted with a different project_id (project isolation invariant). This invariant does not apply to ai_accounts, which are intentionally global.
7. WHEN a Knowledge_Card is deleted, THE App SHALL ensure that subsequent synchronous queries for all Knowledge_Cards by project_id do not return the deleted card (deletion consistency property).
8. FOR ALL context blocks produced by the Context_Builder, the Token_Estimator's count for that block SHALL satisfy `|estimated − actual| / actual ≤ 0.10`, where actual is the token count produced by the cl100k_base BPE tokenizer (tiktoken) for the same text (estimation accuracy property).
9. FOR ALL file paths stored in project_files.imports, THE Import_Scanner SHALL ensure that re-parsing a file whose content has not changed produces a JSON array that is identical to the previous parse result (parse stability property: parse(content) = parse(content)).
10. THE Context_Builder SHALL ensure that no file path appears more than once in any assembled context block, regardless of how many modes or selection sources caused it to be included (deduplication invariant).
