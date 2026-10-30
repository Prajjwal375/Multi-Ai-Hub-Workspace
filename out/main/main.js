"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const electron = require("electron");
const path = require("path");
const Database = require("better-sqlite3");
const fs = require("fs");
const uuid = require("uuid");
const chokidar = require("chokidar");
const ws = require("ws");
const is = {
  dev: !electron.app.isPackaged
};
const platform = {
  isWindows: process.platform === "win32",
  isMacOS: process.platform === "darwin",
  isLinux: process.platform === "linux"
};
const electronApp = {
  setAppUserModelId(id) {
    if (platform.isWindows)
      electron.app.setAppUserModelId(is.dev ? process.execPath : id);
  },
  setAutoLaunch(auto) {
    if (platform.isLinux)
      return false;
    const isOpenAtLogin = () => {
      return electron.app.getLoginItemSettings().openAtLogin;
    };
    if (isOpenAtLogin() !== auto) {
      electron.app.setLoginItemSettings({
        openAtLogin: auto,
        path: process.execPath
      });
      return isOpenAtLogin() === auto;
    } else {
      return true;
    }
  },
  skipProxy() {
    return electron.session.defaultSession.setProxy({ mode: "direct" });
  }
};
const optimizer = {
  watchWindowShortcuts(window, shortcutOptions) {
    if (!window)
      return;
    const { webContents } = window;
    const { escToCloseWindow = false, zoom = false } = shortcutOptions || {};
    webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown") {
        if (!is.dev) {
          if (input.code === "KeyR" && (input.control || input.meta))
            event.preventDefault();
        } else {
          if (input.code === "F12") {
            if (webContents.isDevToolsOpened()) {
              webContents.closeDevTools();
            } else {
              webContents.openDevTools({ mode: "undocked" });
              console.log("Open dev tool...");
            }
          }
        }
        if (escToCloseWindow) {
          if (input.code === "Escape" && input.key !== "Process") {
            window.close();
            event.preventDefault();
          }
        }
        if (!zoom) {
          if (input.code === "Minus" && (input.control || input.meta))
            event.preventDefault();
          if (input.code === "Equal" && input.shift && (input.control || input.meta))
            event.preventDefault();
        }
      }
    });
  },
  registerFramelessWindowIpc() {
    electron.ipcMain.on("win:invoke", (event, action) => {
      const win = electron.BrowserWindow.fromWebContents(event.sender);
      if (win) {
        if (action === "show") {
          win.show();
        } else if (action === "showInactive") {
          win.showInactive();
        } else if (action === "min") {
          win.minimize();
        } else if (action === "max") {
          const isMaximized = win.isMaximized();
          if (isMaximized) {
            win.unmaximize();
          } else {
            win.maximize();
          }
        } else if (action === "close") {
          win.close();
        }
      }
    });
  }
};
let db;
const SCHEMA = `
    CREATE TABLE IF NOT EXISTS projects (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL CHECK(length(name) >= 1 AND length(name) <= 100),
      folder_path    TEXT NOT NULL,
      created_at     TEXT NOT NULL,
      last_opened_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS project_files (
      id            TEXT PRIMARY KEY,
      project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      file_path     TEXT NOT NULL,
      content       TEXT NOT NULL DEFAULT '',
      imports       TEXT NOT NULL DEFAULT '[]',
      last_modified TEXT NOT NULL,
      is_active     INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_project_files_path ON project_files(project_id, file_path);
    CREATE TABLE IF NOT EXISTS ai_accounts (
      id                TEXT PRIMARY KEY,
      model             TEXT NOT NULL CHECK(length(model) <= 100),
      label             TEXT NOT NULL CHECK(length(label) <= 50),
      session_partition TEXT NOT NULL UNIQUE,
      is_active         INTEGER NOT NULL DEFAULT 0,
      created_at        TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chats (
      id         TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      model      TEXT NOT NULL,
      account_id TEXT NOT NULL REFERENCES ai_accounts(id),
      title      TEXT NOT NULL DEFAULT 'New Chat',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chats_project ON chats(project_id);
    CREATE TABLE IF NOT EXISTS knowledge_cards (
      id             TEXT PRIMARY KEY,
      project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      content        TEXT NOT NULL CHECK(length(content) <= 10000),
      category       TEXT,
      tags           TEXT NOT NULL DEFAULT '[]',
      source_model   TEXT,
      source_chat_id TEXT REFERENCES chats(id),
      created_at     TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge_cards(project_id);
    CREATE TABLE IF NOT EXISTS project_settings (
      project_id                TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
      default_context_mode      TEXT NOT NULL DEFAULT 'smart'
                                  CHECK(default_context_mode IN ('smart','selected','full')),
      auto_include_active_file  INTEGER NOT NULL DEFAULT 1,
      max_auto_context_tokens   INTEGER,
      ignore_patterns           TEXT NOT NULL DEFAULT '[]'
    );
`;
function initDatabase() {
  const dbPath = path.join(electron.app.getPath("userData"), "sakai-hub.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
}
function now() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function rowToProject(row) {
  return {
    id: row.id,
    name: row.name,
    folderPath: row.folder_path,
    createdAt: row.created_at,
    lastOpenedAt: row.last_opened_at
  };
}
function rowToFile(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    filePath: row.file_path,
    content: row.content,
    imports: JSON.parse(row.imports ?? "[]"),
    lastModified: row.last_modified,
    isActive: row.is_active === 1
  };
}
function rowToAccount(row) {
  return {
    id: row.id,
    model: row.model,
    label: row.label,
    sessionPartition: row.session_partition,
    isActive: row.is_active === 1,
    createdAt: row.created_at
  };
}
function rowToChat(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    model: row.model,
    accountId: row.account_id,
    title: row.title,
    createdAt: row.created_at
  };
}
function rowToCard(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    content: row.content,
    category: row.category ?? null,
    tags: JSON.parse(row.tags ?? "[]"),
    sourceModel: row.source_model ?? null,
    sourceChatId: row.source_chat_id ?? null,
    createdAt: row.created_at
  };
}
function rowToProjectSettings(row) {
  return {
    projectId: row.project_id,
    defaultContextMode: row.default_context_mode,
    autoIncludeActiveFile: row.auto_include_active_file === 1,
    maxAutoContextTokens: row.max_auto_context_tokens ?? null,
    ignorePatterns: JSON.parse(row.ignore_patterns ?? "[]")
  };
}
function listProjects() {
  const rows = db.prepare(
    "SELECT * FROM projects ORDER BY last_opened_at DESC"
  ).all();
  return rows.map(rowToProject);
}
function createProject(name, folderPath) {
  if (!name || name.length < 1 || name.length > 100) {
    throw { code: "VALIDATION", message: "Name must be 1–100 characters", field: "name" };
  }
  if (!fs.existsSync(folderPath)) {
    throw { code: "FS_ERROR", message: "Folder path does not exist on disk", field: "folderPath" };
  }
  const id = uuid.v4();
  const ts = now();
  db.prepare(
    "INSERT INTO projects (id, name, folder_path, created_at, last_opened_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, name, folderPath, ts, ts);
  db.prepare(
    "INSERT OR IGNORE INTO project_settings (project_id) VALUES (?)"
  ).run(id);
  return rowToProject(db.prepare("SELECT * FROM projects WHERE id = ?").get(id));
}
function getProject(id) {
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  return row ? rowToProject(row) : null;
}
function openProject(id) {
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!row) throw { code: "NOT_FOUND", message: "Project not found" };
  if (!fs.existsSync(row.folder_path)) {
    throw { code: "FS_ERROR", message: `Folder path no longer exists: ${row.folder_path}` };
  }
  db.prepare("UPDATE projects SET last_opened_at = ? WHERE id = ?").run(now(), id);
  db.prepare("INSERT OR IGNORE INTO project_settings (project_id) VALUES (?)").run(id);
  return rowToProject(db.prepare("SELECT * FROM projects WHERE id = ?").get(id));
}
function renameProject(id, name) {
  if (!name || name.length < 1 || name.length > 100) {
    throw { code: "VALIDATION", message: "Name must be 1–100 characters", field: "name" };
  }
  db.prepare("UPDATE projects SET name = ? WHERE id = ?").run(name, id);
}
function deleteProject(id) {
  const deleteStmt = db.transaction(() => {
    db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  });
  deleteStmt();
}
function updateProjectFolderPath(id, folderPath) {
  if (!fs.existsSync(folderPath)) {
    throw { code: "FS_ERROR", message: "Folder path does not exist on disk", field: "folderPath" };
  }
  db.prepare("UPDATE projects SET folder_path = ? WHERE id = ?").run(folderPath, id);
}
function listFiles(projectId) {
  const rows = db.prepare(
    "SELECT * FROM project_files WHERE project_id = ? ORDER BY file_path ASC"
  ).all(projectId);
  return rows.map(rowToFile);
}
function upsertFile(projectId, filePath, content, imports, lastModified) {
  const existing = db.prepare(
    "SELECT id FROM project_files WHERE project_id = ? AND file_path = ?"
  ).get(projectId, filePath);
  if (existing) {
    db.prepare(
      "UPDATE project_files SET content = ?, imports = ?, last_modified = ? WHERE id = ?"
    ).run(content, JSON.stringify(imports), lastModified, existing.id);
  } else {
    db.prepare(
      "INSERT INTO project_files (id, project_id, file_path, content, imports, last_modified) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(uuid.v4(), projectId, filePath, content, JSON.stringify(imports), lastModified);
  }
}
function deleteFile(projectId, filePath) {
  db.prepare(
    "DELETE FROM project_files WHERE project_id = ? AND file_path = ?"
  ).run(projectId, filePath);
}
function setActiveFile(projectId, filePath) {
  db.transaction(() => {
    db.prepare("UPDATE project_files SET is_active = 0 WHERE project_id = ?").run(projectId);
    db.prepare(
      "UPDATE project_files SET is_active = 1 WHERE project_id = ? AND file_path = ?"
    ).run(projectId, filePath);
  })();
}
function getImportGraph(projectId) {
  const rows = db.prepare(
    "SELECT file_path, imports FROM project_files WHERE project_id = ?"
  ).all(projectId);
  return rows.map((r) => [r.file_path, JSON.parse(r.imports ?? "[]")]);
}
function listAccounts() {
  const rows = db.prepare("SELECT * FROM ai_accounts ORDER BY created_at ASC").all();
  return rows.map(rowToAccount);
}
function createAccount(model, label) {
  const id = uuid.v4();
  const partition = `persist:${model}-${id}`;
  try {
    db.prepare(
      "INSERT INTO ai_accounts (id, model, label, session_partition, is_active, created_at) VALUES (?, ?, ?, ?, 0, ?)"
    ).run(id, model, label, partition, now());
  } catch (e) {
    if (e.message?.includes("UNIQUE")) {
      throw { code: "DUPLICATE", message: "An account with this session partition already exists" };
    }
    throw e;
  }
  return rowToAccount(db.prepare("SELECT * FROM ai_accounts WHERE id = ?").get(id));
}
function setActiveAccount(id) {
  const account = db.prepare("SELECT * FROM ai_accounts WHERE id = ?").get(id);
  if (!account) throw { code: "NOT_FOUND", message: "Account not found" };
  db.transaction(() => {
    db.prepare("UPDATE ai_accounts SET is_active = 0 WHERE model = ?").run(account.model);
    db.prepare("UPDATE ai_accounts SET is_active = 1 WHERE id = ?").run(id);
  })();
}
function removeAccount(id) {
  db.prepare("DELETE FROM ai_accounts WHERE id = ?").run(id);
}
function listChats(projectId) {
  const rows = db.prepare(
    "SELECT * FROM chats WHERE project_id = ? ORDER BY created_at DESC"
  ).all(projectId);
  return rows.map(rowToChat);
}
function createChat(projectId, model, accountId) {
  const id = uuid.v4();
  db.prepare(
    "INSERT INTO chats (id, project_id, model, account_id, title, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, projectId, model, accountId, "New Chat", now());
  return rowToChat(db.prepare("SELECT * FROM chats WHERE id = ?").get(id));
}
function listCards(projectId) {
  const rows = db.prepare(
    "SELECT * FROM knowledge_cards WHERE project_id = ? ORDER BY created_at DESC"
  ).all(projectId);
  return rows.map(rowToCard);
}
function createCard(input) {
  const id = uuid.v4();
  db.prepare(`
    INSERT INTO knowledge_cards
      (id, project_id, content, category, tags, source_model, source_chat_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.projectId,
    input.content,
    input.category ?? null,
    JSON.stringify(input.tags ?? []),
    input.sourceModel ?? null,
    input.sourceChatId ?? null,
    now()
  );
  return rowToCard(db.prepare("SELECT * FROM knowledge_cards WHERE id = ?").get(id));
}
function deleteCard(id) {
  db.prepare("DELETE FROM knowledge_cards WHERE id = ?").run(id);
}
function searchCards(projectId, query) {
  const q = `%${query.toLowerCase()}%`;
  const rows = db.prepare(`
    SELECT * FROM knowledge_cards
    WHERE project_id = ?
      AND (lower(content) LIKE ? OR lower(category) LIKE ? OR lower(tags) LIKE ?)
    ORDER BY created_at DESC
  `).all(projectId, q, q, q);
  return rows.map(rowToCard);
}
function getAppSetting(key) {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key);
  return row?.value ?? null;
}
function setAppSetting(key, value) {
  db.prepare(
    "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}
function getProjectSettings(projectId) {
  db.prepare("INSERT OR IGNORE INTO project_settings (project_id) VALUES (?)").run(projectId);
  const row = db.prepare("SELECT * FROM project_settings WHERE project_id = ?").get(projectId);
  return rowToProjectSettings(row);
}
function setProjectSettings(projectId, input) {
  db.prepare("INSERT OR IGNORE INTO project_settings (project_id) VALUES (?)").run(projectId);
  if (input.defaultContextMode !== void 0) {
    db.prepare("UPDATE project_settings SET default_context_mode = ? WHERE project_id = ?").run(input.defaultContextMode, projectId);
  }
  if (input.autoIncludeActiveFile !== void 0) {
    db.prepare("UPDATE project_settings SET auto_include_active_file = ? WHERE project_id = ?").run(input.autoIncludeActiveFile ? 1 : 0, projectId);
  }
  if (input.maxAutoContextTokens !== void 0) {
    db.prepare("UPDATE project_settings SET max_auto_context_tokens = ? WHERE project_id = ?").run(input.maxAutoContextTokens, projectId);
  }
  if (input.ignorePatterns !== void 0) {
    db.prepare("UPDATE project_settings SET ignore_patterns = ? WHERE project_id = ?").run(JSON.stringify(input.ignorePatterns), projectId);
  }
}
function closeDatabase() {
  if (db) {
    try {
      db.pragma("wal_checkpoint(TRUNCATE)");
      db.close();
    } catch {
    }
  }
}
const ES_IMPORT_REGEX = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
const CJS_REQUIRE_REGEX = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
function scanFile(content, filePath, _projectRoot) {
  const imports = [];
  try {
    const allMatches = [
      ...content.matchAll(ES_IMPORT_REGEX),
      ...content.matchAll(CJS_REQUIRE_REGEX)
    ];
    for (const match of allMatches) {
      const specifier = match[1];
      if (!specifier) continue;
      if (specifier.startsWith("./") || specifier.startsWith("../")) {
        const resolved = path.resolve(path.dirname(filePath), specifier);
        imports.push(resolved);
      } else {
        imports.push(`unresolved:${specifier}`);
      }
    }
  } catch {
    return [];
  }
  return imports;
}
const MAX_FILE_SIZE = 2 * 1024 * 1024;
async function mirrorFileToDb(projectId, folderPath, filePath) {
  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile() || stat.size > MAX_FILE_SIZE) return false;
    const content = await fs.promises.readFile(filePath, "utf-8");
    if (content.includes("\0")) return false;
    const imports = scanFile(content, filePath, folderPath);
    upsertFile(projectId, filePath, content, imports, stat.mtime.toISOString());
    return true;
  } catch {
    return false;
  }
}
function removeFileFromDb(projectId, filePath) {
  try {
    deleteFile(projectId, filePath);
  } catch {
  }
}
class FileWatcher {
  constructor(projectId, folderPath, ignorePatterns) {
    this.projectId = projectId;
    this.folderPath = folderPath;
    this.ignorePatterns = ignorePatterns;
  }
  watcher = null;
  debounceMap = /* @__PURE__ */ new Map();
  scanComplete = false;
  async start() {
    const defaultIgnored = [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/out/**",
      "**/coverage/**",
      "**/*.log",
      "**/.DS_Store"
    ];
    this.watcher = chokidar.watch(this.folderPath, {
      ignored: [...defaultIgnored, ...this.ignorePatterns],
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: { stabilityThreshold: 200 }
    });
    return new Promise((resolve) => {
      let fileCount = 0;
      let skipCount = 0;
      const pending = [];
      this.watcher.on("add", (filePath) => {
        const p = this.mirrorFile(filePath).then((ok) => {
          if (ok) fileCount++;
          else skipCount++;
        });
        pending.push(p);
      });
      this.watcher.on("change", (filePath) => {
        this.debounceFile(filePath);
      });
      this.watcher.on("unlink", (filePath) => {
        this.onFileDelete(filePath);
      });
      this.watcher.on("ready", async () => {
        await Promise.allSettled(pending);
        this.scanComplete = true;
        resolve({
          fileCount,
          skipCount,
          completedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      });
      this.watcher.on("error", (err) => {
        console.error("[FileWatcher] error:", err);
        exports.mainWindow?.webContents.send("files:folderUnavailable", this.projectId);
      });
    });
  }
  async stop() {
    await this.watcher?.close();
    this.watcher = null;
    this.debounceMap.clear();
    this.scanComplete = false;
  }
  updateIgnorePatterns(patterns) {
    this.ignorePatterns = patterns;
  }
  debounceFile(filePath) {
    const existing = this.debounceMap.get(filePath);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(async () => {
      this.debounceMap.delete(filePath);
      await this.mirrorFile(filePath);
      this.emitChanged(filePath, "change");
    }, 500);
    this.debounceMap.set(filePath, timer);
  }
  /**
   * Reads a file, stores its content + parsed imports in the DB.
   * Returns true if mirrored, false if skipped (binary/too large/unreadable).
   */
  async mirrorFile(filePath) {
    const ok = await mirrorFileToDb(this.projectId, this.folderPath, filePath);
    if (ok && this.scanComplete) this.emitChanged(filePath, "add");
    return ok;
  }
  onFileDelete(filePath) {
    removeFileFromDb(this.projectId, filePath);
    this.emitChanged(filePath, "unlink");
  }
  emitChanged(filePath, event) {
    exports.mainWindow?.webContents.send("files:changed", {
      projectId: this.projectId,
      filePath,
      event
    });
  }
}
class ProjectManager {
  watcher = null;
  activeProjectId = null;
  getActiveProjectId() {
    return this.activeProjectId;
  }
  /** Start watching a project's folder. Stops any previous watcher first. */
  async openProject(projectId) {
    await this.closeProject();
    const project = getProject(projectId);
    if (!project) throw { code: "NOT_FOUND", message: "Project not found" };
    const settings = getProjectSettings(projectId);
    this.watcher = new FileWatcher(projectId, project.folderPath, settings.ignorePatterns);
    this.activeProjectId = projectId;
    await this.watcher.start();
  }
  /** Stop the active watcher (on project switch / app close). */
  async closeProject() {
    if (this.watcher) {
      await this.watcher.stop();
      this.watcher = null;
    }
    this.activeProjectId = null;
  }
  /** Restart the watcher for the active project (e.g. folder path changed). */
  async restart(projectId) {
    if (this.activeProjectId === projectId) {
      await this.openProject(projectId);
    }
  }
  /** Update ignore patterns live without a full restart. */
  updateIgnorePatterns(projectId, patterns) {
    if (this.activeProjectId === projectId && this.watcher) {
      this.watcher.updateIgnorePatterns(patterns);
    }
  }
}
const projectManager = new ProjectManager();
function registerProjectHandlers(ipcMain) {
  ipcMain.handle("projects:list", async () => {
    return listProjects();
  });
  ipcMain.handle("projects:create", async (_e, input) => {
    return createProject(input.name, input.folderPath);
  });
  ipcMain.handle("projects:open", async (_e, id) => {
    const project = openProject(id);
    try {
      await projectManager.openProject(id);
    } catch (err) {
      console.error("[projects:open] watcher failed:", err);
    }
    return project;
  });
  ipcMain.handle("projects:rename", async (_e, id, name) => {
    renameProject(id, name);
  });
  ipcMain.handle("projects:delete", async (_e, id) => {
    if (projectManager.getActiveProjectId() === id) {
      await projectManager.closeProject();
    }
    deleteProject(id);
  });
  ipcMain.handle("projects:updateFolderPath", async (_e, id, folderPath) => {
    updateProjectFolderPath(id, folderPath);
    await projectManager.restart(id);
  });
  ipcMain.handle("files:list", async (_e, projectId) => {
    return listFiles(projectId);
  });
  ipcMain.handle("files:getImportGraph", async (_e, projectId) => {
    return getImportGraph(projectId);
  });
}
function jsString(value) {
  return JSON.stringify(value);
}
function buildInjectScript(selectors, contextBlock) {
  return `
(function () {
  try {
    const text = ${jsString(contextBlock)};
    const selectors = ${JSON.stringify(selectors)};
    let el = null;
    for (const sel of selectors) {
      el = document.querySelector(sel);
      if (el) break;
    }
    if (!el) return { ok: false, reason: 'input-not-found' };

    el.focus();

    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const proto = el.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      const existing = el.value ? el.value + '\\n\\n' : '';
      setter.call(el, existing + text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el.isContentEditable) {
      // ProseMirror / Lexical contenteditable inputs
      el.focus();
      const lines = text.split('\\n');
      // Use execCommand for broad compatibility, falling back to textContent
      const ok = document.execCommand('insertText', false, text);
      if (!ok) {
        el.textContent = (el.textContent ? el.textContent + '\\n\\n' : '') + text;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      return { ok: false, reason: 'unsupported-input' };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
})();
`;
}
const claude = {
  model: "claude",
  url: "https://claude.ai",
  inputSelectors: [
    'div[contenteditable="true"].ProseMirror',
    'div[contenteditable="true"]',
    "textarea"
  ],
  messageSelector: '[data-testid="message"], .font-claude-message',
  injectScript(contextBlock) {
    return buildInjectScript(this.inputSelectors, contextBlock);
  }
};
const chatgpt = {
  model: "chatgpt",
  url: "https://chatgpt.com",
  inputSelectors: [
    "#prompt-textarea",
    'div[contenteditable="true"]#prompt-textarea',
    'div[contenteditable="true"]',
    "textarea"
  ],
  messageSelector: '[data-message-author-role="assistant"]',
  injectScript(contextBlock) {
    return buildInjectScript(this.inputSelectors, contextBlock);
  }
};
const gemini = {
  model: "gemini",
  url: "https://gemini.google.com",
  inputSelectors: [
    'div.ql-editor[contenteditable="true"]',
    'rich-textarea div[contenteditable="true"]',
    'div[contenteditable="true"]',
    "textarea"
  ],
  messageSelector: "message-content, .model-response-text",
  injectScript(contextBlock) {
    return buildInjectScript(this.inputSelectors, contextBlock);
  }
};
const grok = {
  model: "grok",
  url: "https://grok.com",
  inputSelectors: [
    "textarea",
    'div[contenteditable="true"]'
  ],
  messageSelector: '.message-bubble, [data-testid="message"]',
  injectScript(contextBlock) {
    return buildInjectScript(this.inputSelectors, contextBlock);
  }
};
const ADAPTERS = {
  claude,
  chatgpt,
  gemini,
  grok
};
function getAdapter(model) {
  return ADAPTERS[model] ?? null;
}
const CHROME_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
function configureSession(partition) {
  const ses = electron.session.fromPartition(partition);
  ses.setUserAgent(CHROME_UA);
  return ses;
}
class WebviewManager {
  views = /* @__PURE__ */ new Map();
  // accountId → view
  visibleAccountId = null;
  /** Create (if needed) and show the webview for an account at given bounds. */
  show(accountId, model, bounds) {
    if (!exports.mainWindow) return;
    if (this.visibleAccountId === accountId && this.views.has(accountId)) {
      this.views.get(accountId).view.setBounds(bounds);
      return;
    }
    if (this.visibleAccountId && this.visibleAccountId !== accountId) {
      this.detach(this.visibleAccountId);
    }
    let entry = this.views.get(accountId);
    if (!entry) {
      const adapter = getAdapter(model);
      if (!adapter) return;
      const partition = `persist:${model}-${accountId}`;
      const ses = configureSession(partition);
      const view = new electron.WebContentsView({
        webPreferences: {
          session: ses,
          preload: path.join(__dirname, "../preload/webviewPreload.js"),
          contextIsolation: true,
          nodeIntegration: false
        }
      });
      view.webContents.loadURL(adapter.url);
      view.webContents.setWindowOpenHandler(() => {
        return { action: "allow" };
      });
      const overlay = buildOverlayScript(adapter.messageSelector);
      view.webContents.on("did-finish-load", () => {
        view.webContents.executeJavaScript(overlay).catch(() => {
        });
      });
      entry = { view, model, partition };
      this.views.set(accountId, entry);
    }
    exports.mainWindow.contentView.addChildView(entry.view);
    entry.view.setBounds(bounds);
    this.visibleAccountId = accountId;
  }
  /** Remove the view from the window (keeps it alive in memory for fast switching). */
  hide(accountId) {
    this.detach(accountId);
  }
  /** Hide whatever is currently visible (used when leaving the Chat screen). */
  hideAll() {
    if (this.visibleAccountId) this.detach(this.visibleAccountId);
  }
  detach(accountId) {
    const entry = this.views.get(accountId);
    if (entry && exports.mainWindow) {
      try {
        exports.mainWindow.contentView.removeChildView(entry.view);
      } catch {
      }
    }
    if (this.visibleAccountId === accountId) this.visibleAccountId = null;
  }
  /** Resize the currently visible view (on layout/window changes). */
  setBounds(bounds) {
    if (this.visibleAccountId) {
      this.views.get(this.visibleAccountId)?.view.setBounds(bounds);
    }
  }
  /** Inject an assembled context block into the provider's input field. */
  async injectContext(accountId, contextBlock) {
    const entry = this.views.get(accountId);
    if (!entry) {
      electron.clipboard.writeText(contextBlock);
      return { success: false, method: "clipboard", error: "No active webview" };
    }
    const adapter = getAdapter(entry.model);
    if (!adapter) {
      electron.clipboard.writeText(contextBlock);
      return { success: false, method: "clipboard", error: "No adapter" };
    }
    try {
      const result = await entry.view.webContents.executeJavaScript(
        adapter.injectScript(contextBlock)
      );
      if (result && result.ok) {
        return { success: true, method: "executeJavaScript" };
      }
      electron.clipboard.writeText(contextBlock);
      return { success: false, method: "clipboard", error: result?.reason ?? "injection-failed" };
    } catch (err) {
      electron.clipboard.writeText(contextBlock);
      return { success: false, method: "clipboard", error: String(err?.message ?? err) };
    }
  }
  /** Destroy a webview and free its memory (on account removal). */
  destroy(accountId) {
    this.detach(accountId);
    const entry = this.views.get(accountId);
    if (entry) {
      try {
        ;
        entry.view.webContents.close?.();
      } catch {
      }
      this.views.delete(accountId);
    }
  }
  /** Wipe a session partition's cookies/storage from disk (on account removal). */
  async destroyPartition(partition) {
    try {
      const ses = electron.session.fromPartition(partition);
      await ses.clearStorageData();
    } catch {
    }
  }
  /** Tear everything down (app quit). */
  destroyAll() {
    for (const accountId of this.views.keys()) {
      this.destroy(accountId);
    }
  }
  /** Find which account owns a given webContents (for save-knowledge routing). */
  findByWebContents(wc) {
    for (const [accountId, entry] of this.views.entries()) {
      if (entry.view.webContents === wc) {
        return { accountId, model: entry.model };
      }
    }
    return null;
  }
  getVisibleAccountId() {
    return this.visibleAccountId;
  }
  /**
   * Open a dedicated login window for an account in its isolated session.
   * The user signs in with their Google/Gmail account; cookies persist in the
   * partition so the embedded chat webview is logged in afterwards.
   *
   * Google OAuth blocks sign-in when it detects the "Electron/" token in the
   * User-Agent string. We work around this by:
   *  1. Setting the UA on the session (covers XHR/fetch requests).
   *  2. Overriding the UA on the webContents directly after creation so the
   *     initial navigation also uses the spoofed Chrome UA.
   *  3. Ensuring any popup windows Google spawns during OAuth inherit the same UA.
   */
  openLogin(accountId, model) {
    const adapter = getAdapter(model);
    if (!adapter) return;
    const partition = `persist:${model}-${accountId}`;
    const ses = configureSession(partition);
    const win = new electron.BrowserWindow({
      width: 480,
      height: 720,
      title: `Sign in to ${ADAPTERS[model].model}`,
      // Do NOT set parent — child/modal windows are a signal Google uses to
      // detect embedded browsers and block OAuth ("Couldn't sign you in").
      // A standalone window looks like a regular Chrome launch to Google.
      autoHideMenuBar: true,
      webPreferences: {
        session: ses,
        // pins the persistent partition (cookies/storage)
        contextIsolation: false,
        // must be false so loginPreload can write to window directly
        nodeIntegration: false,
        preload: path.join(__dirname, "../preload/loginPreload.js")
      }
    });
    win.webContents.setUserAgent(CHROME_UA);
    win.webContents.setWindowOpenHandler(({ url }) => {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          webPreferences: {
            session: ses,
            contextIsolation: true,
            nodeIntegration: false
          }
        }
      };
    });
    win.webContents.on("did-create-window", (popup) => {
      popup.webContents.setUserAgent(CHROME_UA);
    });
    win.loadURL(adapter.url);
    win.on("closed", () => {
      exports.mainWindow?.webContents.send("accounts:loginClosed", accountId);
    });
  }
}
function buildOverlayScript(messageSelector) {
  return `
(function () {
  if (window.__sakaiOverlayInstalled) return;
  window.__sakaiOverlayInstalled = true;

  const SELECTOR = ${JSON.stringify(messageSelector)};

  function addButton(msg) {
    if (msg.dataset.sakaiOverlay) return;
    msg.dataset.sakaiOverlay = '1';
    if (getComputedStyle(msg).position === 'static') {
      msg.style.position = 'relative';
    }
    const btn = document.createElement('button');
    btn.textContent = '⭐ Save to Knowledge';
    btn.style.cssText = [
      'position:absolute','top:6px','right:6px','z-index:99999',
      'font-size:11px','font-weight:600','padding:4px 8px','border-radius:8px',
      'border:1px solid rgba(0,0,0,0.1)','background:rgba(59,130,246,0.95)',
      'color:#fff','cursor:pointer','opacity:0','transition:opacity .15s',
      'box-shadow:0 2px 6px rgba(0,0,0,0.15)'
    ].join(';');
    msg.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
    msg.addEventListener('mouseleave', () => { btn.style.opacity = '0'; });
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      const text = (msg.innerText || msg.textContent || '').trim();
      if (text && window.__sakai && window.__sakai.saveKnowledge) {
        window.__sakai.saveKnowledge(text);
        btn.textContent = '✓ Saved';
        setTimeout(() => { btn.textContent = '⭐ Save to Knowledge'; }, 1500);
      }
    });
    msg.appendChild(btn);
  }

  function scan() {
    try {
      document.querySelectorAll(SELECTOR).forEach(addButton);
    } catch (e) {}
  }

  scan();
  const observer = new MutationObserver(() => scan());
  observer.observe(document.body, { childList: true, subtree: true });
})();
`;
}
const webviewManager = new WebviewManager();
function registerAccountHandlers(ipcMain) {
  ipcMain.handle("accounts:list", async () => {
    return listAccounts();
  });
  ipcMain.handle("accounts:add", async (_e, input) => {
    return createAccount(input.model, input.label);
  });
  ipcMain.handle("accounts:setActive", async (_e, id) => {
    setActiveAccount(id);
  });
  ipcMain.handle("accounts:remove", async (_e, id) => {
    const account = listAccounts().find((a) => a.id === id);
    removeAccount(id);
    webviewManager.destroy(id);
    if (account) {
      await webviewManager.destroyPartition(account.sessionPartition);
    }
  });
}
function registerChatHandlers(ipcMain) {
  ipcMain.handle("chats:list", async (_e, projectId) => {
    return listChats(projectId);
  });
  ipcMain.handle("chats:create", async (_e, input) => {
    return createChat(input.projectId, input.model, input.accountId);
  });
}
function registerKnowledgeHandlers(ipcMain) {
  ipcMain.handle("knowledge:list", async (_e, projectId) => {
    return listCards(projectId);
  });
  ipcMain.handle("knowledge:create", async (_e, input) => {
    if (!input.content || !input.content.trim()) {
      throw { code: "VALIDATION", message: "Content cannot be empty", field: "content" };
    }
    if (input.content.length > 1e4) {
      throw { code: "VALIDATION", message: "Content must be 10,000 characters or fewer", field: "content" };
    }
    return createCard(input);
  });
  ipcMain.handle("knowledge:delete", async (_e, id) => {
    deleteCard(id);
  });
  ipcMain.handle("knowledge:search", async (_e, projectId, query) => {
    return searchCards(projectId, query);
  });
}
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
function assembleContext(input) {
  const {
    mode,
    projectFiles,
    activeFile,
    importGraph,
    checkedFileIds,
    checkedCardIds,
    knowledgeCards,
    ignorePatterns,
    maxTokens,
    userMessage,
    projectName
  } = input;
  const sections = [];
  const emitted = /* @__PURE__ */ new Set();
  const RECENT_CUTOFF = new Date(Date.now() - 30 * 60 * 1e3).toISOString();
  if (projectName) {
    const fileTotal = projectFiles.length;
    const cardTotal = knowledgeCards.filter((c) => checkedCardIds.includes(c.id)).length;
    sections.push(
      `# SaKAi Hub — Shared Project Context
Project: **${projectName}**
This is the shared working memory for this project, kept consistent across Claude, ChatGPT, Gemini, and Grok. It reflects the live state of the codebase (${fileTotal} file${fileTotal === 1 ? "" : "s"} mirrored) and ${cardTotal} pinned knowledge card${cardTotal === 1 ? "" : "s"}. Treat it as authoritative project context.`
    );
  }
  if (mode === "full") {
    const visible = projectFiles.filter((f) => !matchesIgnoreList(f.filePath, ignorePatterns));
    const tree = buildFolderTree(visible.map((f) => f.filePath));
    if (tree) sections.push(`## Folder Structure

${tree}`);
  }
  if (activeFile && mode !== "full" && !emitted.has(activeFile.filePath)) {
    sections.push(`## Active File: ${fileName(activeFile.filePath)}

${fileBlock(activeFile)}`);
    emitted.add(activeFile.filePath);
  }
  if (mode === "smart" && activeFile) {
    const imports = importGraph.get(activeFile.filePath) ?? [];
    const importedFiles = projectFiles.filter(
      (f) => imports.includes(f.filePath) && !emitted.has(f.filePath)
    );
    if (importedFiles.length > 0) {
      sections.push(`## Imported Files

${importedFiles.map(fileBlock).join("\n\n")}`);
      importedFiles.forEach((f) => emitted.add(f.filePath));
    }
  }
  if (mode === "smart") {
    const recent = projectFiles.filter(
      (f) => f.lastModified >= RECENT_CUTOFF && !emitted.has(f.filePath)
    );
    if (recent.length > 0) {
      sections.push(`## Recently Changed Files

${recent.map(fileBlock).join("\n\n")}`);
      recent.forEach((f) => emitted.add(f.filePath));
    }
  }
  if (mode === "selected") {
    const selected = projectFiles.filter(
      (f) => checkedFileIds.includes(f.id) && !emitted.has(f.filePath)
    );
    if (selected.length > 0) {
      sections.push(`## Project Files

${selected.map(fileBlock).join("\n\n")}`);
      selected.forEach((f) => emitted.add(f.filePath));
    }
  } else if (mode === "full") {
    const visible = projectFiles.filter(
      (f) => !matchesIgnoreList(f.filePath, ignorePatterns) && !emitted.has(f.filePath)
    );
    if (visible.length > 0) {
      sections.push(`## Project Files

${visible.map(fileBlock).join("\n\n")}`);
      visible.forEach((f) => emitted.add(f.filePath));
    }
  }
  const selectedCards = knowledgeCards.filter((c) => checkedCardIds.includes(c.id));
  if (selectedCards.length > 0) {
    const cardText = selectedCards.map((c) => c.content).join("\n\n---\n\n");
    sections.push(`## Knowledge Cards

${cardText}`);
  }
  if (userMessage) {
    sections.push(`## User Question

${userMessage}`);
  }
  let result = sections.join("\n\n");
  if (mode === "smart" && maxTokens) {
    while (estimateTokens(result) > maxTokens && sections.length > 1) {
      const lastIsQuestion = userMessage && sections[sections.length - 1].startsWith("## User Question");
      if (lastIsQuestion && sections.length >= 2) {
        sections.splice(sections.length - 2, 1);
      } else {
        sections.pop();
      }
      result = sections.join("\n\n");
    }
  }
  return result;
}
function fileBlock(file) {
  return `\`\`\`${file.filePath}
${file.content}
\`\`\``;
}
function fileName(filePath) {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}
function matchesIgnoreList(filePath, patterns) {
  const defaultIgnored = ["node_modules", ".git", "dist", "build", ".next", "out", "coverage", ".log", ".DS_Store"];
  const allPatterns = [...defaultIgnored, ...patterns];
  return allPatterns.some((p) => p.length > 0 && filePath.includes(p));
}
function buildFolderTree(paths) {
  return [...paths].sort().join("\n");
}
function registerContextHandlers(ipcMain) {
  ipcMain.handle("context:assemble", async (_e, input) => {
    return assembleContext(input);
  });
  ipcMain.handle("context:estimateTokens", async (_e, text) => {
    return estimateTokens(text);
  });
}
function registerSettingsHandlers(ipcMain) {
  ipcMain.handle("settings:getApp", async () => {
    const theme = getAppSetting("theme") ?? "light";
    return { theme };
  });
  ipcMain.handle("settings:setApp", async (_e, key, value) => {
    setAppSetting(key, value);
  });
  ipcMain.handle("settings:getProject", async (_e, projectId) => {
    return getProjectSettings(projectId);
  });
  ipcMain.handle("settings:setProject", async (_e, projectId, input) => {
    setProjectSettings(projectId, input);
    if (input.ignorePatterns !== void 0) {
      projectManager.updateIgnorePatterns(projectId, input.ignorePatterns);
    }
  });
}
function registerWebviewHandlers(ipcMain) {
  ipcMain.handle("webview:show", async (_e, accountId, model, bounds) => {
    webviewManager.show(accountId, model, bounds);
  });
  ipcMain.handle("webview:hide", async (_e, accountId) => {
    webviewManager.hide(accountId);
  });
  ipcMain.handle("webview:hideAll", async () => {
    webviewManager.hideAll();
  });
  ipcMain.handle("webview:setBounds", async (_e, bounds) => {
    webviewManager.setBounds(bounds);
  });
  ipcMain.handle("webview:injectContext", async (_e, accountId, contextBlock) => {
    return webviewManager.injectContext(accountId, contextBlock);
  });
  ipcMain.handle("webview:login", async (_e, accountId, model) => {
    webviewManager.openLogin(accountId, model);
  });
  ipcMain.handle("webview:saveKnowledge", async (_e, payload) => {
    const projectId = projectManager.getActiveProjectId();
    if (!projectId) throw { code: "NOT_FOUND", message: "No active project" };
    if (!payload?.content?.trim()) {
      throw { code: "VALIDATION", message: "Content cannot be empty", field: "content" };
    }
    return createCard({
      projectId,
      content: payload.content.trim(),
      sourceModel: payload.sourceModel,
      sourceChatId: payload.sourceChatId
    });
  });
  electron.ipcMain.on("webview:save-knowledge", (e, text) => {
    const projectId = projectManager.getActiveProjectId();
    if (!projectId || !text?.trim()) {
      exports.mainWindow?.webContents.send("knowledge:saveFailed", { reason: "empty-or-no-project" });
      return;
    }
    const match = webviewManager.findByWebContents(e.sender);
    try {
      const card = createCard({
        projectId,
        content: text.trim(),
        sourceModel: match?.model
      });
      exports.mainWindow?.webContents.send("knowledge:saved", card);
    } catch (err) {
      exports.mainWindow?.webContents.send("knowledge:saveFailed", { reason: String(err) });
    }
  });
}
function normalize(p) {
  return p.replace(/\\/g, "/").toLowerCase();
}
function matchProject(filePath) {
  const target = normalize(filePath);
  try {
    for (const project of listProjects()) {
      if (target.startsWith(normalize(project.folderPath))) {
        return { id: project.id, folderPath: project.folderPath };
      }
    }
  } catch {
  }
  return null;
}
class WsServer {
  wss = null;
  connected = false;
  retries = 0;
  static MAX_RETRIES = 10;
  static PORT = 54321;
  start() {
    const server = new ws.WebSocketServer({ host: "0.0.0.0", port: WsServer.PORT });
    this.wss = server;
    server.on("listening", () => {
      this.retries = 0;
      console.log(`[WsServer] Listening on port ${WsServer.PORT}`);
    });
    server.on("connection", (ws2) => {
      this.connected = true;
      this.emitStatus(true);
      ws2.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === "active-file" && typeof msg.path === "string") {
            this.handleActiveFile(msg.path);
          } else if (msg.type === "file-saved" && typeof msg.path === "string") {
            this.handleFileSaved(msg.path);
          }
        } catch {
        }
      });
      ws2.on("close", () => {
        this.connected = false;
        this.emitStatus(false);
      });
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        server.close(() => {
          if (this.retries >= WsServer.MAX_RETRIES) {
            console.error(`[WsServer] Port ${WsServer.PORT} still in use after ${WsServer.MAX_RETRIES} retries. Giving up.`);
            this.wss = null;
            return;
          }
          this.retries++;
          console.warn(`[WsServer] Port ${WsServer.PORT} already in use — retrying in 3s… (attempt ${this.retries}/${WsServer.MAX_RETRIES})`);
          this.wss = null;
          setTimeout(() => this.start(), 3e3);
        });
      } else {
        console.error("[WsServer] error:", err.message);
      }
    });
  }
  stop() {
    this.wss?.close();
    this.wss = null;
    this.retries = 0;
  }
  getStatus() {
    return this.connected ? "connected" : "disconnected";
  }
  /**
   * Prefix-match the incoming file path against every project's folder_path.
   * If a project owns the path, mark that file active in the DB and notify
   * the renderer so the Context Panel highlights it instantly.
   */
  handleActiveFile(filePath) {
    const match = matchProject(filePath);
    if (!match) return;
    try {
      setActiveFile(match.id, filePath);
      exports.mainWindow?.webContents.send("files:changed", {
        projectId: match.id,
        filePath,
        event: "active"
      });
    } catch {
    }
  }
  /** A save in VS Code → re-mirror that exact file immediately (no debounce). */
  handleFileSaved(filePath) {
    const match = matchProject(filePath);
    if (!match) return;
    mirrorFileToDb(match.id, match.folderPath, filePath).then((ok) => {
      if (ok) {
        exports.mainWindow?.webContents.send("files:changed", {
          projectId: match.id,
          filePath,
          event: "change"
        });
      }
    }).catch(() => {
    });
  }
  emitStatus(connected) {
    exports.mainWindow?.webContents.send("ws:status", { connected });
  }
}
exports.mainWindow = null;
let wsServer = null;
function createWindow() {
  exports.mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false
    }
  });
  exports.mainWindow.on("ready-to-show", () => {
    exports.mainWindow?.show();
  });
  exports.mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    exports.mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    exports.mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.sakai.hub");
  electron.app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });
  initDatabase();
  registerProjectHandlers(electron.ipcMain);
  registerAccountHandlers(electron.ipcMain);
  registerChatHandlers(electron.ipcMain);
  registerKnowledgeHandlers(electron.ipcMain);
  registerContextHandlers(electron.ipcMain);
  registerSettingsHandlers(electron.ipcMain);
  registerWebviewHandlers(electron.ipcMain);
  wsServer = new WsServer();
  wsServer.start();
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    wsServer?.stop();
    webviewManager.destroyAll();
    projectManager.closeProject();
    electron.app.quit();
  }
});
electron.app.on("before-quit", () => {
  wsServer?.stop();
  webviewManager.destroyAll();
  closeDatabase();
});
