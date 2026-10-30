import { WebSocketServer, WebSocket } from 'ws'
import { mainWindow } from './main'
import { listProjects, setActiveFile } from './db'
import { mirrorFileToDb } from './fileMirror'

function normalize(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase()
}

/** Find the project whose folder_path is a prefix of the given file path. */
function matchProject(filePath: string): { id: string; folderPath: string } | null {
  const target = normalize(filePath)
  try {
    for (const project of listProjects()) {
      if (target.startsWith(normalize(project.folderPath))) {
        return { id: project.id, folderPath: project.folderPath }
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

export class WsServer {
  private wss: WebSocketServer | null = null
  private connected = false
  private retries = 0
  private static readonly MAX_RETRIES = 10
  private static readonly PORT = 54321

  start(): void {
    // Listen on 0.0.0.0 so both ::1 (IPv6) and 127.0.0.1 (IPv4) work
    const server = new WebSocketServer({ host: '0.0.0.0', port: WsServer.PORT })
    this.wss = server

    server.on('listening', () => {
      this.retries = 0 // reset on successful bind
      console.log(`[WsServer] Listening on port ${WsServer.PORT}`)
    })

    server.on('connection', (ws: WebSocket) => {
      this.connected = true
      this.emitStatus(true)

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString())
          if (msg.type === 'active-file' && typeof msg.path === 'string') {
            this.handleActiveFile(msg.path)
          } else if (msg.type === 'file-saved' && typeof msg.path === 'string') {
            this.handleFileSaved(msg.path)
          }
        } catch {
          // ignore malformed messages
        }
      })

      ws.on('close', () => {
        this.connected = false
        this.emitStatus(false)
      })
    })

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        // IMPORTANT: close the failed server's underlying socket before retrying.
        // Without this the leaked socket keeps the port "busy" and the retry
        // loop never escapes — even after the old process exits.
        server.close(() => {
          if (this.retries >= WsServer.MAX_RETRIES) {
            console.error(`[WsServer] Port ${WsServer.PORT} still in use after ${WsServer.MAX_RETRIES} retries. Giving up.`)
            this.wss = null
            return
          }
          this.retries++
          console.warn(`[WsServer] Port ${WsServer.PORT} already in use — retrying in 3s… (attempt ${this.retries}/${WsServer.MAX_RETRIES})`)
          this.wss = null
          setTimeout(() => this.start(), 3000)
        })
      } else {
        console.error('[WsServer] error:', err.message)
      }
    })
  }

  stop(): void {
    this.wss?.close()
    this.wss = null
    this.retries = 0
  }

  getStatus(): 'connected' | 'disconnected' {
    return this.connected ? 'connected' : 'disconnected'
  }

  /**
   * Prefix-match the incoming file path against every project's folder_path.
   * If a project owns the path, mark that file active in the DB and notify
   * the renderer so the Context Panel highlights it instantly.
   */
  private handleActiveFile(filePath: string): void {
    const match = matchProject(filePath)
    if (!match) return // unmatched path → silently discard (per spec)

    try {
      setActiveFile(match.id, filePath)
      mainWindow?.webContents.send('files:changed', {
        projectId: match.id,
        filePath,
        event: 'active',
      })
    } catch {
      /* ignore */
    }
  }

  /** A save in VS Code → re-mirror that exact file immediately (no debounce). */
  private handleFileSaved(filePath: string): void {
    const match = matchProject(filePath)
    if (!match) return
    mirrorFileToDb(match.id, match.folderPath, filePath)
      .then((ok) => {
        if (ok) {
          mainWindow?.webContents.send('files:changed', {
            projectId: match.id,
            filePath,
            event: 'change',
          })
        }
      })
      .catch(() => {})
  }

  private emitStatus(connected: boolean): void {
    mainWindow?.webContents.send('ws:status', { connected })
  }
}
