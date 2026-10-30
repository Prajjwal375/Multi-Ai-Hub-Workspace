import { promises as fs } from 'fs'
import { upsertFile, deleteFile } from './db'
import { scanFile } from './importScanner'

// Max file size to mirror (2 MB). Larger files are skipped.
const MAX_FILE_SIZE = 2 * 1024 * 1024

/**
 * Read a single file from disk and store its content + parsed imports in the
 * DB. Shared by the chokidar FileWatcher and the VS Code file-saved fast path.
 * Returns true if mirrored, false if skipped (binary / too large / unreadable).
 */
export async function mirrorFileToDb(
  projectId: string,
  folderPath: string,
  filePath: string
): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath)
    if (!stat.isFile() || stat.size > MAX_FILE_SIZE) return false

    const content = await fs.readFile(filePath, 'utf-8')
    if (content.includes('\u0000')) return false // binary

    const imports = scanFile(content, filePath, folderPath)
    upsertFile(projectId, filePath, content, imports, stat.mtime.toISOString())
    return true
  } catch {
    return false
  }
}

export function removeFileFromDb(projectId: string, filePath: string): void {
  try {
    deleteFile(projectId, filePath)
  } catch {
    /* ignore */
  }
}
