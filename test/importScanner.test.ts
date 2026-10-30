import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { resolve, dirname } from 'path'
import { scanFile } from '../electron/importScanner'

describe('importScanner', () => {
  // Feature: sakai-hub, Property 9: Import scanner determinism
  it('Property 9: produces identical output across invocations', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (content, name) => {
        const filePath = `/proj/src/${name || 'a'}.ts`
        const a = scanFile(content, filePath, '/proj')
        const b = scanFile(content, filePath, '/proj')
        expect(a).toEqual(b)
      }),
      { numRuns: 100 }
    )
  })

  // Feature: sakai-hub, Property 10: Relative import path resolution
  it('Property 10: resolves ./ and ../ imports to absolute paths', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('./foo', '../bar', './a/b/c', '../../x'),
        (spec) => {
          const filePath = '/proj/src/index.ts'
          const content = `import x from '${spec}'`
          const result = scanFile(content, filePath, '/proj')
          const expected = resolve(dirname(filePath), spec)
          expect(result).toContain(expected)
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: sakai-hub, Property 11: Non-relative imports recorded as "unresolved:"
  it('Property 11: marks bare/aliased specifiers as unresolved', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('react', 'lodash', '@scope/pkg', 'node:fs', '@/alias'),
        (spec) => {
          const content = `import x from '${spec}'`
          const result = scanFile(content, '/proj/src/a.ts', '/proj')
          expect(result).toContain(`unresolved:${spec}`)
          // It must NOT appear as a plain resolved path
          expect(result).not.toContain(resolve('/proj/src', spec))
        }
      ),
      { numRuns: 100 }
    )
  })

  it('parses both ES imports and CJS requires', () => {
    const content = `
      import a from './a'
      const b = require('./b')
      import c from 'react'
    `
    const result = scanFile(content, '/proj/index.ts', '/proj')
    expect(result).toContain(resolve('/proj', './a'))
    expect(result).toContain(resolve('/proj', './b'))
    expect(result).toContain('unresolved:react')
  })
})
