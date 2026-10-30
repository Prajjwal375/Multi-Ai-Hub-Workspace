import type { IpcMain } from 'electron'
import { ipcMain as ipc } from 'electron'
import { webviewManager, type Bounds } from '../webviewManager'
import { projectManager } from '../projectManager'
import { createCard } from '../db'
import { mainWindow } from '../main'
import type { ProviderModel } from '../adapters'

export function registerWebviewHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('webview:show', async (_e, accountId: string, model: ProviderModel, bounds: Bounds) => {
    webviewManager.show(accountId, model, bounds)
  })

  ipcMain.handle('webview:hide', async (_e, accountId: string) => {
    webviewManager.hide(accountId)
  })

  ipcMain.handle('webview:hideAll', async () => {
    webviewManager.hideAll()
  })

  ipcMain.handle('webview:setBounds', async (_e, bounds: Bounds) => {
    webviewManager.setBounds(bounds)
  })

  ipcMain.handle('webview:injectContext', async (_e, accountId: string, contextBlock: string) => {
    return webviewManager.injectContext(accountId, contextBlock)
  })

  ipcMain.handle('webview:login', async (_e, accountId: string, model: string) => {
    webviewManager.openLogin(accountId, model as any)
  })

  ipcMain.handle('webview:saveKnowledge', async (_e, payload: { content: string; sourceModel: string; sourceChatId?: string }) => {
    const projectId = projectManager.getActiveProjectId()
    if (!projectId) throw { code: 'NOT_FOUND', message: 'No active project' }
    if (!payload?.content?.trim()) {
      throw { code: 'VALIDATION', message: 'Content cannot be empty', field: 'content' }
    }
    return createCard({
      projectId,
      content: payload.content.trim(),
      sourceModel: payload.sourceModel,
      sourceChatId: payload.sourceChatId,
    })
  })

  // Save-to-Knowledge clicks coming from inside the AI webview overlay
  ipc.on('webview:save-knowledge', (e, text: string) => {
    const projectId = projectManager.getActiveProjectId()
    if (!projectId || !text?.trim()) {
      mainWindow?.webContents.send('knowledge:saveFailed', { reason: 'empty-or-no-project' })
      return
    }
    const match = webviewManager.findByWebContents(e.sender)
    try {
      const card = createCard({
        projectId,
        content: text.trim(),
        sourceModel: match?.model,
      })
      // Notify renderer so the Knowledge Base refreshes + toast shows
      mainWindow?.webContents.send('knowledge:saved', card)
    } catch (err) {
      mainWindow?.webContents.send('knowledge:saveFailed', { reason: String(err) })
    }
  })
}
