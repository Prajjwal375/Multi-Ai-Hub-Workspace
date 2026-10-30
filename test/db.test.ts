import { describe, it, expect, beforeEach, vi } from 'vitest'
import fc from 'fast-check'
import { tmpdir } from 'os'

// db.ts imports `app` from electron only inside initDatabase(), which we don't call.
// Mock electron so the module import resolves cleanly under Node.
vi.mock('electron', () => ({ app: { getPath: () => tmpdir() } }))

import {
  initTestDatabase,
  getDb,
  listProjects,
  createProject,
  renameProject,
  deleteProject,
  createAccount,
  createChat,
  createCard,
  deleteCard,
  listCards,
} from '../electron/db'

// A folder path that exists on disk so createProject's existsSync check passes
const REAL_PATH = tmpdir()

beforeEach(() => {
  initTestDatabase()
})

describe('db', () => {
  // Feature: sakai-hub, Property 1: Project name validation (1–100 chars)
  it('Property 1: accepts 1–100 char names, rejects empty / >100', () => {
    fc.assert(
      fc.property(fc.string(), (name) => {
        const valid = name.length >= 1 && name.length <= 100
        if (valid) {
          const p = createProject(name, REAL_PATH)
          expect(p.name).toBe(name)
        } else {
          expect(() => createProject(name, REAL_PATH)).toThrow()
        }
      }),
      { numRuns: 100 }
    )
  })

  // Feature: sakai-hub, Property 2: Project list sort order (last_opened_at DESC)
  it('Property 2: listProjects is sorted by lastOpenedAt descending', () => {
    // Create several projects with increasing timestamps
    for (let i = 0; i < 5; i++) {
      createProject(`proj-${i}`, REAL_PATH)
    }
    const list = listProjects()
    for (let i = 0; i + 1 < list.length; i++) {
      expect(list[i].lastOpenedAt >= list[i + 1].lastOpenedAt).toBe(true)
    }
  })

  // Feature: sakai-hub, Property 3: Project rename round-trip
  it('Property 3: rename then list returns the new name', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (newName) => {
          const p = createProject('original', REAL_PATH)
          renameProject(p.id, newName)
          const found = listProjects().find((x) => x.id === p.id)
          expect(found?.name).toBe(newName)
        }
      ),
      { numRuns: 50 }
    )
  })

  // Feature: sakai-hub, Property 4: Referential integrity (FK enforcement)
  it('Property 4: inserting a row with a bad project_id is rejected', () => {
    const db = getDb()
    expect(() =>
      db.prepare(
        "INSERT INTO project_files (id, project_id, file_path, last_modified) VALUES ('f1','nonexistent','/a.ts','2026')"
      ).run()
    ).toThrow()
  })

  // Feature: sakai-hub, Property 5: Project isolation — no cross-project leakage
  it('Property 5: queries scoped by project_id never return other projects rows', () => {
    const a = createProject('A', REAL_PATH)
    const b = createProject('B', REAL_PATH)
    createCard({ projectId: a.id, content: 'card-a' })
    createCard({ projectId: b.id, content: 'card-b' })

    const aCards = listCards(a.id)
    const bCards = listCards(b.id)
    expect(aCards.every((c) => c.projectId === a.id)).toBe(true)
    expect(bCards.every((c) => c.projectId === b.id)).toBe(true)
    expect(aCards.some((c) => c.content === 'card-b')).toBe(false)
  })

  // Feature: sakai-hub, Property 6: Cascade delete removes all per-project rows
  it('Property 6: deleting a project cascades to its files/chats/cards/settings', () => {
    const p = createProject('to-delete', REAL_PATH)
    const acc = createAccount('claude', 'Personal')
    createChat(p.id, 'claude', acc.id)
    createCard({ projectId: p.id, content: 'note' })
    getDb().prepare(
      "INSERT INTO project_files (id, project_id, file_path, last_modified) VALUES ('f1',?,'/a.ts','2026')"
    ).run(p.id)

    deleteProject(p.id)

    const db = getDb()
    expect(db.prepare('SELECT COUNT(*) n FROM project_files WHERE project_id = ?').get(p.id)).toMatchObject({ n: 0 })
    expect(db.prepare('SELECT COUNT(*) n FROM chats WHERE project_id = ?').get(p.id)).toMatchObject({ n: 0 })
    expect(db.prepare('SELECT COUNT(*) n FROM knowledge_cards WHERE project_id = ?').get(p.id)).toMatchObject({ n: 0 })
    expect(db.prepare('SELECT COUNT(*) n FROM project_settings WHERE project_id = ?').get(p.id)).toMatchObject({ n: 0 })
    // ai_accounts is global — must survive
    expect(db.prepare('SELECT COUNT(*) n FROM ai_accounts WHERE id = ?').get(acc.id)).toMatchObject({ n: 1 })
  })

  // Feature: sakai-hub, Property 18: Knowledge card content round-trip identity
  it('Property 18: stored card content is byte-identical to input', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 5000 }), (content) => {
        const p = createProject('rt', REAL_PATH)
        const card = createCard({ projectId: p.id, content })
        const found = listCards(p.id).find((c) => c.id === card.id)
        expect(found?.content).toBe(content)
      }),
      { numRuns: 50 }
    )
  })

  // Feature: sakai-hub, Property 19: Knowledge card deletion consistency
  it('Property 19: deleted card never appears in subsequent queries', () => {
    const p = createProject('del', REAL_PATH)
    const card = createCard({ projectId: p.id, content: 'temp' })
    deleteCard(card.id)
    expect(listCards(p.id).some((c) => c.id === card.id)).toBe(false)
  })
})
