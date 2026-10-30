import type { IpcMain } from 'electron'
import { listChats, createChat } from '../db'

export function registerChatHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('chats:list', async (_e, projectId: string) => {
    return listChats(projectId)
  })

  ipcMain.handle('chats:create', async (_e, input: { projectId: string; model: string; accountId: string }) => {
    return createChat(input.projectId, input.model, input.accountId)
  })
}
