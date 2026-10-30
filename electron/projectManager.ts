import { FileWatcher } from './fileWatcher'
import { getProject, getProjectSettings } from './db'

/**
 * Owns the single active FileWatcher. Only one project is "open" at a time,
 * matching the renderer's single-active-project model.
 */
class ProjectManager {
  private watcher: FileWatcher | null = null
  private activeProjectId: string | null = null

  getActiveProjectId(): string | null {
    return this.activeProjectId
  }

  /** Start watching a project's folder. Stops any previous watcher first. */
  async openProject(projectId: string): Promise<void> {
    await this.closeProject()

    const project = getProject(projectId)
    if (!project) throw { code: 'NOT_FOUND', message: 'Project not found' }

    const settings = getProjectSettings(projectId)
    this.watcher = new FileWatcher(projectId, project.folderPath, settings.ignorePatterns)
    this.activeProjectId = projectId

    // Run the initial scan; resolves once chokidar is ready
    await this.watcher.start()
  }

  /** Stop the active watcher (on project switch / app close). */
  async closeProject(): Promise<void> {
    if (this.watcher) {
      await this.watcher.stop()
      this.watcher = null
    }
    this.activeProjectId = null
  }

  /** Restart the watcher for the active project (e.g. folder path changed). */
  async restart(projectId: string): Promise<void> {
    if (this.activeProjectId === projectId) {
      await this.openProject(projectId)
    }
  }

  /** Update ignore patterns live without a full restart. */
  updateIgnorePatterns(projectId: string, patterns: string[]): void {
    if (this.activeProjectId === projectId && this.watcher) {
      this.watcher.updateIgnorePatterns(patterns)
    }
  }
}

export const projectManager = new ProjectManager()
