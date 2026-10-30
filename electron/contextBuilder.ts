import type { AssembleContextInput, ProjectFile } from '../src/types'
import { estimateTokens } from './tokenEstimator'

/**
 * Pure function — deterministic, no side effects, idempotent.
 * Assembles a structured context block from project files and knowledge cards.
 *
 * Section order (empty sections omitted):
 *   Folder Structure → Active File → Imported Files →
 *   Recently Changed Files → Project Files → Knowledge Cards → User Question
 *
 * Every file's content block appears at most once (deduplicated by path).
 */
export function assembleContext(input: AssembleContextInput): string {
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
    projectName,
  } = input

  const sections: string[] = []
  const emitted = new Set<string>() // file paths already written to output

  const RECENT_CUTOFF = new Date(Date.now() - 30 * 60 * 1000).toISOString()

  // ── Shared Project Memory header ────────────────────────────────────
  // Frames the block identically for every provider so Claude, ChatGPT,
  // Gemini, and Grok all receive the same situational awareness.
  if (projectName) {
    const fileTotal = projectFiles.length
    const cardTotal = knowledgeCards.filter((c) => checkedCardIds.includes(c.id)).length
    sections.push(
      `# SaKAi Hub — Shared Project Context\n` +
        `Project: **${projectName}**\n` +
        `This is the shared working memory for this project, kept consistent across ` +
        `Claude, ChatGPT, Gemini, and Grok. It reflects the live state of the codebase ` +
        `(${fileTotal} file${fileTotal === 1 ? '' : 's'} mirrored) and ${cardTotal} pinned ` +
        `knowledge card${cardTotal === 1 ? '' : 's'}. Treat it as authoritative project context.`
    )
  }

  // ── Folder Structure (full mode only) ──────────────────────────────
  if (mode === 'full') {
    const visible = projectFiles.filter((f) => !matchesIgnoreList(f.filePath, ignorePatterns))
    const tree = buildFolderTree(visible.map((f) => f.filePath))
    if (tree) sections.push(`## Folder Structure\n\n${tree}`)
  }

  // ── Active File ─────────────────────────────────────────────────────
  if (activeFile && mode !== 'full' && !emitted.has(activeFile.filePath)) {
    sections.push(`## Active File: ${fileName(activeFile.filePath)}\n\n${fileBlock(activeFile)}`)
    emitted.add(activeFile.filePath)
  }

  // ── Imported Files (smart mode, 1-level imports of the active file) ──
  if (mode === 'smart' && activeFile) {
    const imports = importGraph.get(activeFile.filePath) ?? []
    const importedFiles = projectFiles.filter(
      (f) => imports.includes(f.filePath) && !emitted.has(f.filePath)
    )
    if (importedFiles.length > 0) {
      sections.push(`## Imported Files\n\n${importedFiles.map(fileBlock).join('\n\n')}`)
      importedFiles.forEach((f) => emitted.add(f.filePath))
    }
  }

  // ── Recently Changed Files (smart mode) ─────────────────────────────
  if (mode === 'smart') {
    const recent = projectFiles.filter(
      (f) => f.lastModified >= RECENT_CUTOFF && !emitted.has(f.filePath)
    )
    if (recent.length > 0) {
      sections.push(`## Recently Changed Files\n\n${recent.map(fileBlock).join('\n\n')}`)
      recent.forEach((f) => emitted.add(f.filePath))
    }
  }

  // ── Project Files (selected / full modes) ───────────────────────────
  if (mode === 'selected') {
    const selected = projectFiles.filter(
      (f) => checkedFileIds.includes(f.id) && !emitted.has(f.filePath)
    )
    if (selected.length > 0) {
      sections.push(`## Project Files\n\n${selected.map(fileBlock).join('\n\n')}`)
      selected.forEach((f) => emitted.add(f.filePath))
    }
  } else if (mode === 'full') {
    const visible = projectFiles.filter(
      (f) => !matchesIgnoreList(f.filePath, ignorePatterns) && !emitted.has(f.filePath)
    )
    if (visible.length > 0) {
      sections.push(`## Project Files\n\n${visible.map(fileBlock).join('\n\n')}`)
      visible.forEach((f) => emitted.add(f.filePath))
    }
  }

  // ── Knowledge Cards ─────────────────────────────────────────────────
  const selectedCards = knowledgeCards.filter((c) => checkedCardIds.includes(c.id))
  if (selectedCards.length > 0) {
    const cardText = selectedCards.map((c) => c.content).join('\n\n---\n\n')
    sections.push(`## Knowledge Cards\n\n${cardText}`)
  }

  // ── User Question ───────────────────────────────────────────────────
  if (userMessage) {
    sections.push(`## User Question\n\n${userMessage}`)
  }

  let result = sections.join('\n\n')

  // ── Token truncation for smart mode (drop from the end) ─────────────
  if (mode === 'smart' && maxTokens) {
    // Preserve the User Question if present (last section)
    while (estimateTokens(result) > maxTokens && sections.length > 1) {
      // Remove the section just before User Question if it exists, else the last
      const lastIsQuestion = userMessage && sections[sections.length - 1].startsWith('## User Question')
      if (lastIsQuestion && sections.length >= 2) {
        sections.splice(sections.length - 2, 1)
      } else {
        sections.pop()
      }
      result = sections.join('\n\n')
    }
  }

  return result
}

function fileBlock(file: ProjectFile): string {
  return `\`\`\`${file.filePath}\n${file.content}\n\`\`\``
}

function fileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath
}

function matchesIgnoreList(filePath: string, patterns: string[]): boolean {
  const defaultIgnored = ['node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage', '.log', '.DS_Store']
  const allPatterns = [...defaultIgnored, ...patterns]
  return allPatterns.some((p) => p.length > 0 && filePath.includes(p))
}

function buildFolderTree(paths: string[]): string {
  return [...paths].sort().join('\n')
}
