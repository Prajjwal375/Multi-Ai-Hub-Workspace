import { create } from 'zustand'
import type { Project } from '../types'
import { useContextStore } from './contextStore'
import { useKnowledgeStore } from './knowledgeStore'

interface ProjectStore {
  activeProject: Project | null
  projects: Project[]
  isLoading: boolean
  error: string | null

  setActiveProject: (project: Project | null) => void
  loadProjects: () => Promise<void>
  createProject: (name: string, folderPath: string) => Promise<Project>
  openProject: (id: string) => Promise<Project>
  renameProject: (id: string, name: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  activeProject: null,
  projects: [],
  isLoading: false,
  error: null,

  setActiveProject: (project) => {
    const current = get().activeProject
    // Reset per-project stores whenever the active project changes
    if (current?.id !== project?.id) {
      useContextStore.getState().reset()
      useKnowledgeStore.getState().reset()
    }
    set({ activeProject: project })
  },

  loadProjects: async () => {
    set({ isLoading: true, error: null })
    try {
      const projects = await window.api.projects.list()
      set({ projects, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: String(err) })
    }
  },

  createProject: async (name, folderPath) => {
    const project = await window.api.projects.create({ name, folderPath })
    await get().loadProjects()
    return project
  },

  openProject: async (id) => {
    const project = await window.api.projects.open(id)
    // Reset per-project stores for the newly opened project
    get().setActiveProject(project)
    return project
  },

  renameProject: async (id, name) => {
    await window.api.projects.rename(id, name)
    await get().loadProjects()
    const active = get().activeProject
    if (active?.id === id) {
      set({ activeProject: { ...active, name } })
    }
  },

  deleteProject: async (id) => {
    await window.api.projects.delete(id)
    const active = get().activeProject
    if (active?.id === id) {
      set({ activeProject: null })
    }
    await get().loadProjects()
  },
}))
