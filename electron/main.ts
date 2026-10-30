import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase, closeDatabase } from './db'
import { registerProjectHandlers } from './handlers/projectHandlers'
import { registerAccountHandlers } from './handlers/accountHandlers'
import { registerChatHandlers } from './handlers/chatHandlers'
import { registerKnowledgeHandlers } from './handlers/knowledgeHandlers'
import { registerContextHandlers } from './handlers/contextHandlers'
import { registerSettingsHandlers } from './handlers/settingsHandlers'
import { registerWebviewHandlers } from './handlers/webviewHandlers'
import { WsServer } from './wsServer'
import { webviewManager } from './webviewManager'
import { projectManager } from './projectManager'

let mainWindow: BrowserWindow | null = null
let wsServer: WsServer | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.sakai.hub')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialise SQLite schema
  initDatabase()

  // Register all IPC handlers
  registerProjectHandlers(ipcMain)
  registerAccountHandlers(ipcMain)
  registerChatHandlers(ipcMain)
  registerKnowledgeHandlers(ipcMain)
  registerContextHandlers(ipcMain)
  registerSettingsHandlers(ipcMain)
  registerWebviewHandlers(ipcMain)

  // Start WebSocket server
  wsServer = new WsServer()
  wsServer.start()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    wsServer?.stop()
    webviewManager.destroyAll()
    projectManager.closeProject()
    app.quit()
  }
})

app.on('before-quit', () => {
  wsServer?.stop()
  webviewManager.destroyAll()
  closeDatabase()
})

export { mainWindow }
