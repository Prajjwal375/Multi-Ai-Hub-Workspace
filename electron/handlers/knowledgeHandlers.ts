import type { IpcMain } from 'electron'
import { listCards, createCard, deleteCard, searchCards } from '../db'
import type { CreateCardInput } from '../../src/types'

export function registerKnowledgeHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('knowledge:list', async (_e, projectId: string) => {
    return listCards(projectId)
  })

  ipcMain.handle('knowledge:create', async (_e, input: CreateCardInput) => {
    if (!input.content || !input.content.trim()) {
      throw { code: 'VALIDATION', message: 'Content cannot be empty', field: 'content' }
    }
    if (input.content.length > 10000) {
      throw { code: 'VALIDATION', message: 'Content must be 10,000 characters or fewer', field: 'content' }
    }
    return createCard(input)
  })

  ipcMain.handle('knowledge:delete', async (_e, id: string) => {
    deleteCard(id)
  })

  ipcMain.handle('knowledge:search', async (_e, projectId: string, query: string) => {
    return searchCards(projectId, query)
  })
}
