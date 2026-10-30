import type { IpcMain } from 'electron'
import { assembleContext } from '../contextBuilder'
import { estimateTokens } from '../tokenEstimator'

export function registerContextHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('context:assemble', async (_e, input) => {
    return assembleContext(input)
  })

  ipcMain.handle('context:estimateTokens', async (_e, text: string) => {
    return estimateTokens(text)
  })
}
