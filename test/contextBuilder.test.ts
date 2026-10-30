import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { assembleContext } from '../electron/contextBuilder'
import type { AssembleContextInput, ProjectFile, KnowledgeCard, ContextMode } from '../src/types'

// ── Arbitraries ────────────────────────────────────────────────────────────

const fileArb = (recent = false): fc.Arbitrary<ProjectFile> =>
  fc.record({
    id: fc.uuid(),
    projectId: fc.constant('p1'),
    filePath: fc.string({ minLength: 1 }).map((s) => `/proj/${s.replace(/[\u0000/]/g, '_')}.ts`),
    content: fc.string(),
    imports: fc.constant([] as string[]),
    lastModified: fc.constant(
      recent ? new Date().toISOString() : new Date(0).toISOString()
    ),
    isActive: fc.constant(false),
  })

const cardArb: fc.Arbitrary<KnowledgeCard> = fc.record({
  id: fc.uuid(),
  projectId: fc.constant('p1'),
  content: fc.string({ minLength: 1 }),
  category: fc.constant(null),
  tags: fc.constant([] as string[]),
  sourceModel: fc.constant(null),
  sourceChatId: fc.constant(null),
  createdAt: fc.constant(new Date().toISOString()),
})

function baseInput(overrides: Partial<AssembleContextInput>): AssembleContextInput {
  return {
    mode: 'smart',
    projectFiles: [],
    importGraph: new Map(),
    checkedFileIds: [],
    checkedCardIds: [],
    knowledgeCards: [],
    ignorePatterns: [],
    ...overrides,
  }
}

describe('contextBuilder', () => {
  // Feature: sakai-hub, Property 13: Context assembly idempotence
  it('Property 13: identical input → byte-identical output', () => {
    fc.assert(
      fc.property(
        fc.array(fileArb(true), { maxLength: 6 }),
        fc.array(cardArb, { maxLength: 4 }),
        fc.constantFrom<ContextMode>('smart', 'selected', 'full'),
        (files, cards, mode) => {
          const input = baseInput({
            mode,
            projectFiles: files,
            knowledgeCards: cards,
            checkedFileIds: files.map((f) => f.id),
            checkedCardIds: cards.map((c) => c.id),
          })
          expect(assembleContext(input)).toBe(assembleContext(input))
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: sakai-hub, Property 14: Section order + empty-section omission
  it('Property 14: sections appear in canonical order, no empty headers', () => {
    fc.assert(
      fc.property(fc.array(fileArb(true), { minLength: 1, maxLength: 5 }), (files) => {
        const active = { ...files[0], isActive: true }
        const input = baseInput({
          mode: 'smart',
          projectFiles: [active, ...files.slice(1)],
          activeFile: active,
          userMessage: 'do the thing',
        })
        const out = assembleContext(input)

        const order = ['## Active File', '## Recently Changed Files', '## User Question']
        const positions = order.map((h) => out.indexOf(h)).filter((p) => p >= 0)
        const sorted = [...positions].sort((a, b) => a - b)
        expect(positions).toEqual(sorted)

        // No empty section headers (header immediately followed by another header)
        expect(out).not.toMatch(/##[^\n]*\n\n##/)
      }),
      { numRuns: 100 }
    )
  })

  // Feature: sakai-hub, Property 15: File deduplication across selection sources
  it('Property 15: a file reachable via multiple sources appears once', () => {
    fc.assert(
      fc.property(fc.array(fileArb(true), { minLength: 2, maxLength: 5 }), (files) => {
        // Make file[1] both an import of the active file AND recently changed
        const active: ProjectFile = { ...files[0], isActive: true }
        const imported = files[1]
        const graph = new Map<string, string[]>([[active.filePath, [imported.filePath]]])
        const input = baseInput({
          mode: 'smart',
          projectFiles: [active, ...files.slice(1)],
          activeFile: active,
          importGraph: graph,
        })
        const out = assembleContext(input)
        // Count occurrences of the imported file's code-block label
        const label = '```' + imported.filePath + '\n'
        const count = out.split(label).length - 1
        expect(count).toBeLessThanOrEqual(1)
      }),
      { numRuns: 100 }
    )
  })

  // Feature: sakai-hub, Property 16: Context block prepend format
  it('Property 16: output ends with the user message under ## User Question', () => {
    fc.assert(
      fc.property(
        fc.array(fileArb(true), { maxLength: 4 }),
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        (files, msg) => {
          const input = baseInput({ mode: 'smart', projectFiles: files, userMessage: msg })
          const out = assembleContext(input)
          expect(out).toContain('## User Question')
          expect(out.endsWith(msg)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: sakai-hub, Property 17: File code block labeling
  it('Property 17: each file content is wrapped in a fenced block labeled with its path', () => {
    fc.assert(
      fc.property(fileArb(true), (file) => {
        const active = { ...file, isActive: true }
        const input = baseInput({ mode: 'smart', projectFiles: [active], activeFile: active })
        const out = assembleContext(input)
        expect(out).toContain('```' + active.filePath + '\n')
      }),
      { numRuns: 100 }
    )
  })

  // Feature: sakai-hub, Property 21: Context output is valid UTF-8, no null bytes
  it('Property 21: output contains no null bytes', () => {
    fc.assert(
      fc.property(fc.array(fileArb(true), { maxLength: 5 }), fc.array(cardArb, { maxLength: 3 }), (files, cards) => {
        const input = baseInput({
          mode: 'full',
          projectFiles: files,
          knowledgeCards: cards,
          checkedCardIds: cards.map((c) => c.id),
        })
        const out = assembleContext(input)
        expect(out.includes('\u0000')).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  // Feature: sakai-hub, Property 22: Selected Files Mode exclusivity
  it('Property 22: selected mode includes only checked files', () => {
    fc.assert(
      fc.property(fc.array(fileArb(false), { minLength: 2, maxLength: 6 }), (files) => {
        // unique paths
        const unique = dedupePaths(files)
        if (unique.length < 2) return
        const checked = unique.slice(0, 1)
        const unchecked = unique.slice(1)
        const input = baseInput({
          mode: 'selected',
          projectFiles: unique,
          checkedFileIds: checked.map((f) => f.id),
        })
        const out = assembleContext(input)
        for (const f of checked) expect(out).toContain('```' + f.filePath + '\n')
        for (const f of unchecked) expect(out).not.toContain('```' + f.filePath + '\n')
      }),
      { numRuns: 100 }
    )
  })

  // Feature: sakai-hub, Property 23: Full Project Mode respects ignore list
  it('Property 23: full mode excludes ignored files', () => {
    fc.assert(
      fc.property(fc.array(fileArb(false), { minLength: 1, maxLength: 5 }), (files) => {
        const unique = dedupePaths(files)
        const withIgnored: ProjectFile[] = [
          ...unique,
          { ...unique[0], id: 'ignored-1', filePath: '/proj/node_modules/dep/index.ts' },
          { ...unique[0], id: 'ignored-2', filePath: '/proj/dist/bundle.ts' },
        ]
        const input = baseInput({ mode: 'full', projectFiles: withIgnored, ignorePatterns: [] })
        const out = assembleContext(input)
        expect(out).not.toContain('```/proj/node_modules/dep/index.ts\n')
        expect(out).not.toContain('```/proj/dist/bundle.ts\n')
      }),
      { numRuns: 100 }
    )
  })
})

function dedupePaths(files: ProjectFile[]): ProjectFile[] {
  const seen = new Set<string>()
  const out: ProjectFile[] = []
  for (const f of files) {
    if (!seen.has(f.filePath)) {
      seen.add(f.filePath)
      out.push(f)
    }
  }
  return out
}
