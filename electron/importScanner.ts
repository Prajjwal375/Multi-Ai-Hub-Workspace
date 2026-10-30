import { resolve, dirname } from 'path'

const ES_IMPORT_REGEX = /import\s+.*?from\s+['"]([^'"]+)['"]/g
const CJS_REQUIRE_REGEX = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g

/**
 * Scans a file's content and returns an array of resolved import paths.
 * Non-relative imports are prefixed with "unresolved:".
 */
export function scanFile(content: string, filePath: string, _projectRoot?: string): string[] {
  const imports: string[] = []

  try {
    const allMatches = [
      ...content.matchAll(ES_IMPORT_REGEX),
      ...content.matchAll(CJS_REQUIRE_REGEX)
    ]

    for (const match of allMatches) {
      const specifier = match[1]
      if (!specifier) continue

      if (specifier.startsWith('./') || specifier.startsWith('../')) {
        const resolved = resolve(dirname(filePath), specifier)
        imports.push(resolved)
      } else {
        imports.push(`unresolved:${specifier}`)
      }
    }
  } catch {
    // Parse failure — return empty array, preserve existing imports
    return []
  }

  return imports
}
