import type { IpcMain } from 'electron'
import {
  listProjects,
  createProject,
  openProject,
  renameProject,
  deleteProject,
  updateProjectFolderPath,
  listFiles,
  getImportGraph,
} from '../db'
import { projectManager } from '../projectManager'

export function registerProjectHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('projects:list', async () => {
    return listProjects()
  })

  ipcMain.handle('projects:create', async (_e, input: { name: string; folderPath: string }) => {
    return createProject(input.name, input.folderPath)
  })

  ipcMain.handle('projects:open', async (_e, id: string) => {
    const project = openProject(id)
    // Start the file watcher + initial scan for this project
    try {
      await projectManager.openProject(id)
    } catch (err) {
      console.error('[projects:open] watcher failed:', err)
    }
    return project
  })

  ipcMain.handle('projects:rename', async (_e, id: string, name: string) => {
    renameProject(id, name)
  })

  ipcMain.handle('projects:delete', async (_e, id: string) => {
    if (projectManager.getActiveProjectId() === id) {
      await projectManager.closeProject()
    }
    deleteProject(id)
  })

  ipcMain.handle('projects:updateFolderPath', async (_e, id: string, folderPath: string) => {
    updateProjectFolderPath(id, folderPath)
    // Restart watcher on the new path
    await projectManager.restart(id)
  })

  // Files
  ipcMain.handle('files:list', async (_e, projectId: string) => {
    return listFiles(projectId)
  })

  ipcMain.handle('files:getImportGraph', async (_e, projectId: string) => {
    return getImportGraph(projectId)
  })
}
