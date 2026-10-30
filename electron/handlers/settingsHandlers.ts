import type { IpcMain } from 'electron'
import {
  getAppSetting,
  setAppSetting,
  getProjectSettings,
  setProjectSettings,
} from '../db'
import { projectManager } from '../projectManager'
import type { ProjectSettingsInput } from '../../src/types'

export function registerSettingsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('settings:getApp', async () => {
    const theme = getAppSetting('theme') ?? 'light'
    return { theme: theme as 'light' | 'dark' }
  })

  ipcMain.handle('settings:setApp', async (_e, key: string, value: string) => {
    setAppSetting(key, value)
  })

  ipcMain.handle('settings:getProject', async (_e, projectId: string) => {
    return getProjectSettings(projectId)
  })

  ipcMain.handle('settings:setProject', async (_e, projectId: string, input: ProjectSettingsInput) => {
    setProjectSettings(projectId, input)
    // Apply ignore patterns live to the watcher
    if (input.ignorePatterns !== undefined) {
      projectManager.updateIgnorePatterns(projectId, input.ignorePatterns)
    }
  })
}
