import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'

let db: Database.Database

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
`

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialised. Call initDatabase() first.')
  return db
}

export function initDatabase(): void {
  const dbPath = join(app.getPath('userData'), 'sakai-hub.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)
}

/** Test-only: initialise an in-memory database with the full schema. */
export function initTestDatabase(): Database.Database {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)
  return db
}

// ─── Type helpers ────────────────────────────────────────────────────────────

function now(): string { return new Date().toISOString() }

function rowToProject(row: any) {
  return {
    id: row.id,
    name: row.name,
    folderPath: row.folder_path,
    createdAt: row.created_at,
    lastOpenedAt: row.last_opened_at,
  }
}

function rowToFile(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    filePath: row.file_path,
    content: row.content,
    imports: JSON.parse(row.imports ?? '[]'),
    lastModified: row.last_modified,
    isActive: row.is_active === 1,
  }
}

function rowToAccount(row: any) {
  return {
    id: row.id,
    model: row.model,
    label: row.label,
    sessionPartition: row.session_partition,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  }
}

function rowToChat(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    model: row.model,
    accountId: row.account_id,
    title: row.title,
    createdAt: row.created_at,
  }
}

function rowToCard(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    content: row.content,
    category: row.category ?? null,
    tags: JSON.parse(row.tags ?? '[]'),
    sourceModel: row.source_model ?? null,
    sourceChatId: row.source_chat_id ?? null,
    createdAt: row.created_at,
  }
}

function rowToProjectSettings(row: any) {
  return {
    projectId: row.project_id,
    defaultContextMode: row.default_context_mode as 'smart' | 'selected' | 'full',
    autoIncludeActiveFile: row.auto_include_active_file === 1,
    maxAutoContextTokens: row.max_auto_context_tokens ?? null,
    ignorePatterns: JSON.parse(row.ignore_patterns ?? '[]'),
  }
}

// ─── Projects ────────────────────────────────────────────────────────────────

export function listProjects() {
  const rows = db.prepare(
    'SELECT * FROM projects ORDER BY last_opened_at DESC'
  ).all()
  return rows.map(rowToProject)
}

export function createProject(name: string, folderPath: string) {
  if (!name || name.length < 1 || name.length > 100) {
    throw { code: 'VALIDATION', message: 'Name must be 1–100 characters', field: 'name' }
  }
  if (!existsSync(folderPath)) {
    throw { code: 'FS_ERROR', message: 'Folder path does not exist on disk', field: 'folderPath' }
  }
  const id = uuidv4()
  const ts = now()
  db.prepare(
    'INSERT INTO projects (id, name, folder_path, created_at, last_opened_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, name, folderPath, ts, ts)

  // Create default project settings
  db.prepare(
    'INSERT OR IGNORE INTO project_settings (project_id) VALUES (?)'
  ).run(id)

  return rowToProject(db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any)
}

export function getProject(id: string) {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
  return row ? rowToProject(row) : null
}

export function openProject(id: string) {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any
  if (!row) throw { code: 'NOT_FOUND', message: 'Project not found' }
  if (!existsSync(row.folder_path)) {
    throw { code: 'FS_ERROR', message: `Folder path no longer exists: ${row.folder_path}` }
  }
  db.prepare('UPDATE projects SET last_opened_at = ? WHERE id = ?').run(now(), id)
  // Ensure settings row exists
  db.prepare('INSERT OR IGNORE INTO project_settings (project_id) VALUES (?)').run(id)
  return rowToProject(db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any)
}

export function renameProject(id: string, name: string) {
  if (!name || name.length < 1 || name.length > 100) {
    throw { code: 'VALIDATION', message: 'Name must be 1–100 characters', field: 'name' }
  }
  db.prepare('UPDATE projects SET name = ? WHERE id = ?').run(name, id)
}

export function deleteProject(id: string) {
  const deleteStmt = db.transaction(() => {
    db.prepare('DELETE FROM projects WHERE id = ?').run(id)
  })
  deleteStmt()
}

export function updateProjectFolderPath(id: string, folderPath: string) {
  if (!existsSync(folderPath)) {
    throw { code: 'FS_ERROR', message: 'Folder path does not exist on disk', field: 'folderPath' }
  }
  db.prepare('UPDATE projects SET folder_path = ? WHERE id = ?').run(folderPath, id)
}

// ─── Project Files ────────────────────────────────────────────────────────────

export function listFiles(projectId: string) {
  const rows = db.prepare(
    'SELECT * FROM project_files WHERE project_id = ? ORDER BY file_path ASC'
  ).all(projectId)
  return rows.map(rowToFile)
}

export function upsertFile(
  projectId: string,
  filePath: string,
  content: string,
  imports: string[],
  lastModified: string
) {
  const existing = db.prepare(
    'SELECT id FROM project_files WHERE project_id = ? AND file_path = ?'
  ).get(projectId, filePath) as any

  if (existing) {
    db.prepare(
      'UPDATE project_files SET content = ?, imports = ?, last_modified = ? WHERE id = ?'
    ).run(content, JSON.stringify(imports), lastModified, existing.id)
  } else {
    db.prepare(
      'INSERT INTO project_files (id, project_id, file_path, content, imports, last_modified) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(uuidv4(), projectId, filePath, content, JSON.stringify(imports), lastModified)
  }
}

export function deleteFile(projectId: string, filePath: string) {
  db.prepare(
    'DELETE FROM project_files WHERE project_id = ? AND file_path = ?'
  ).run(projectId, filePath)
}

export function setActiveFile(projectId: string, filePath: string) {
  db.transaction(() => {
    db.prepare('UPDATE project_files SET is_active = 0 WHERE project_id = ?').run(projectId)
    db.prepare(
      'UPDATE project_files SET is_active = 1 WHERE project_id = ? AND file_path = ?'
    ).run(projectId, filePath)
  })()
}

export function getImportGraph(projectId: string): [string, string[]][] {
  const rows = db.prepare(
    'SELECT file_path, imports FROM project_files WHERE project_id = ?'
  ).all(projectId) as any[]
  return rows.map((r) => [r.file_path, JSON.parse(r.imports ?? '[]')])
}

// ─── AI Accounts ─────────────────────────────────────────────────────────────

export function listAccounts() {
  const rows = db.prepare('SELECT * FROM ai_accounts ORDER BY created_at ASC').all()
  return rows.map(rowToAccount)
}

export function createAccount(model: string, label: string) {
  const id = uuidv4()
  const partition = `persist:${model}-${id}`
  try {
    db.prepare(
      'INSERT INTO ai_accounts (id, model, label, session_partition, is_active, created_at) VALUES (?, ?, ?, ?, 0, ?)'
    ).run(id, model, label, partition, now())
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      throw { code: 'DUPLICATE', message: 'An account with this session partition already exists' }
    }
    throw e
  }
  return rowToAccount(db.prepare('SELECT * FROM ai_accounts WHERE id = ?').get(id) as any)
}

export function setActiveAccount(id: string) {
  const account = db.prepare('SELECT * FROM ai_accounts WHERE id = ?').get(id) as any
  if (!account) throw { code: 'NOT_FOUND', message: 'Account not found' }
  db.transaction(() => {
    // Deactivate all accounts for same model
    db.prepare('UPDATE ai_accounts SET is_active = 0 WHERE model = ?').run(account.model)
    db.prepare('UPDATE ai_accounts SET is_active = 1 WHERE id = ?').run(id)
  })()
}

export function removeAccount(id: string) {
  db.prepare('DELETE FROM ai_accounts WHERE id = ?').run(id)
}

// ─── Chats ────────────────────────────────────────────────────────────────────

export function listChats(projectId: string) {
  const rows = db.prepare(
    'SELECT * FROM chats WHERE project_id = ? ORDER BY created_at DESC'
  ).all(projectId)
  return rows.map(rowToChat)
}

export function createChat(projectId: string, model: string, accountId: string) {
  const id = uuidv4()
  db.prepare(
    'INSERT INTO chats (id, project_id, model, account_id, title, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, projectId, model, accountId, 'New Chat', now())
  return rowToChat(db.prepare('SELECT * FROM chats WHERE id = ?').get(id) as any)
}

// ─── Knowledge Cards ──────────────────────────────────────────────────────────

export function listCards(projectId: string) {
  const rows = db.prepare(
    'SELECT * FROM knowledge_cards WHERE project_id = ? ORDER BY created_at DESC'
  ).all(projectId)
  return rows.map(rowToCard)
}

export function createCard(input: {
  projectId: string
  content: string
  category?: string
  tags?: string[]
  sourceModel?: string
  sourceChatId?: string
}) {
  const id = uuidv4()
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
  )
  return rowToCard(db.prepare('SELECT * FROM knowledge_cards WHERE id = ?').get(id) as any)
}

export function deleteCard(id: string) {
  db.prepare('DELETE FROM knowledge_cards WHERE id = ?').run(id)
}

export function searchCards(projectId: string, query: string) {
  const q = `%${query.toLowerCase()}%`
  const rows = db.prepare(`
    SELECT * FROM knowledge_cards
    WHERE project_id = ?
      AND (lower(content) LIKE ? OR lower(category) LIKE ? OR lower(tags) LIKE ?)
    ORDER BY created_at DESC
  `).all(projectId, q, q, q)
  return rows.map(rowToCard)
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export function getAppSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as any
  return row?.value ?? null
}

export function setAppSetting(key: string, value: string) {
  db.prepare(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value)
}

export function getProjectSettings(projectId: string) {
  db.prepare('INSERT OR IGNORE INTO project_settings (project_id) VALUES (?)').run(projectId)
  const row = db.prepare('SELECT * FROM project_settings WHERE project_id = ?').get(projectId) as any
  return rowToProjectSettings(row)
}

export function setProjectSettings(projectId: string, input: {
  defaultContextMode?: 'smart' | 'selected' | 'full'
  autoIncludeActiveFile?: boolean
  maxAutoContextTokens?: number | null
  ignorePatterns?: string[]
}) {
  db.prepare('INSERT OR IGNORE INTO project_settings (project_id) VALUES (?)').run(projectId)
  if (input.defaultContextMode !== undefined) {
    db.prepare('UPDATE project_settings SET default_context_mode = ? WHERE project_id = ?')
      .run(input.defaultContextMode, projectId)
  }
  if (input.autoIncludeActiveFile !== undefined) {
    db.prepare('UPDATE project_settings SET auto_include_active_file = ? WHERE project_id = ?')
      .run(input.autoIncludeActiveFile ? 1 : 0, projectId)
  }
  if (input.maxAutoContextTokens !== undefined) {
    db.prepare('UPDATE project_settings SET max_auto_context_tokens = ? WHERE project_id = ?')
      .run(input.maxAutoContextTokens, projectId)
  }
  if (input.ignorePatterns !== undefined) {
    db.prepare('UPDATE project_settings SET ignore_patterns = ? WHERE project_id = ?')
      .run(JSON.stringify(input.ignorePatterns), projectId)
  }
}

/** Cleanly checkpoint the WAL into the main DB file and close on app quit. */
export function closeDatabase(): void {
  if (db) {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)')
      db.close()
    } catch {
      /* ignore */
    }
  }
}

export { db }
