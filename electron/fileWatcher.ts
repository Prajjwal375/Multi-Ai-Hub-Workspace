import chokidar, { FSWatcher } from 'chokidar'
import { mainWindow } from './main'
import { mirrorFileToDb, removeFileFromDb } from './fileMirror'

export interface InitialScanResult {
  fileCount: number
  skipCount: number
  completedAt: string
}

export class FileWatcher {
  private watcher: FSWatcher | null = null
  private debounceMap = new Map<string, ReturnType<typeof setTimeout>>()
  private scanComplete = false

  constructor(
    private projectId: string,
    private folderPath: string,
    private ignorePatterns: string[]
  ) {}

  async start(): Promise<InitialScanResult> {
    const defaultIgnored = [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/out/**',
      '**/coverage/**',
      '**/*.log',
      '**/.DS_Store'
    ]

    this.watcher = chokidar.watch(this.folderPath, {
      ignored: [...defaultIgnored, ...this.ignorePatterns],
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: { stabilityThreshold: 200 }
    })

    return new Promise((resolve) => {
      let fileCount = 0
      let skipCount = 0
      const pending: Promise<void>[] = []

      this.watcher!.on('add', (filePath) => {
        // During initial scan, mirror immediately; track counts
        const p = this.mirrorFile(filePath).then((ok) => {
          if (ok) fileCount++
          else skipCount++
        })
        pending.push(p)
      })

      this.watcher!.on('change', (filePath) => {
        this.debounceFile(filePath)
      })

      this.watcher!.on('unlink', (filePath) => {
        this.onFileDelete(filePath)
      })

      this.watcher!.on('ready', async () => {
        await Promise.allSettled(pending)
        this.scanComplete = true
        resolve({
          fileCount,
          skipCount,
          completedAt: new Date().toISOString()
        })
      })

      this.watcher!.on('error', (err) => {
        console.error('[FileWatcher] error:', err)
        mainWindow?.webContents.send('files:folderUnavailable', this.projectId)
      })
    })
  }

  async stop(): Promise<void> {
    await this.watcher?.close()
    this.watcher = null
    this.debounceMap.clear()
    this.scanComplete = false
  }

  updateIgnorePatterns(patterns: string[]): void {
    this.ignorePatterns = patterns
  }

  private debounceFile(filePath: string): void {
    const existing = this.debounceMap.get(filePath)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(async () => {
      this.debounceMap.delete(filePath)
      await this.mirrorFile(filePath)
      this.emitChanged(filePath, 'change')
    }, 500)
    this.debounceMap.set(filePath, timer)
  }

  /**
   * Reads a file, stores its content + parsed imports in the DB.
   * Returns true if mirrored, false if skipped (binary/too large/unreadable).
   */
  private async mirrorFile(filePath: string): Promise<boolean> {
    const ok = await mirrorFileToDb(this.projectId, this.folderPath, filePath)
    if (ok && this.scanComplete) this.emitChanged(filePath, 'add')
    return ok
  }

  private onFileDelete(filePath: string): void {
    removeFileFromDb(this.projectId, filePath)
    this.emitChanged(filePath, 'unlink')
  }

  private emitChanged(filePath: string, event: 'add' | 'change' | 'unlink'): void {
    mainWindow?.webContents.send('files:changed', {
      projectId: this.projectId,
      filePath,
      event
    })
  }
}
