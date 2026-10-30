import type { IpcMain } from 'electron'
import { listAccounts, createAccount, setActiveAccount, removeAccount } from '../db'
import { webviewManager } from '../webviewManager'

export function registerAccountHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('accounts:list', async () => {
    return listAccounts()
  })

  ipcMain.handle('accounts:add', async (_e, input: { model: string; label: string }) => {
    return createAccount(input.model, input.label)
  })

  ipcMain.handle('accounts:setActive', async (_e, id: string) => {
    setActiveAccount(id)
  })

  ipcMain.handle('accounts:remove', async (_e, id: string) => {
    // Find the partition before deleting so we can wipe its session storage
    const account = listAccounts().find((a) => a.id === id)
    removeAccount(id)
    webviewManager.destroy(id)
    if (account) {
      await webviewManager.destroyPartition(account.sessionPartition)
    }
  })
}
