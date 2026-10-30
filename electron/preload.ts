import { contextBridge, ipcRenderer } from 'electron'
import type {
  Project, CreateProjectInput,
  AiAccount, AddAccountInput,
  Chat, CreateChatInput,
  KnowledgeCard, CreateCardInput,
  ProjectSettings, ProjectSettingsInput,
  AppSettings,
  AssembleContextInput,
  InjectionResult,
  SaveKnowledgePayload,
  WsStatus
} from '../src/types'

contextBridge.exposeInMainWorld('api', {
  // Projects
  projects: {
    list: (): Promise<Project[]> => ipcRenderer.invoke('projects:list'),
    create: (input: CreateProjectInput): Promise<Project> => ipcRenderer.invoke('projects:create', input),
    open: (id: string): Promise<Project> => ipcRenderer.invoke('projects:open', id),
    rename: (id: string, name: string): Promise<void> => ipcRenderer.invoke('projects:rename', id, name),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('projects:delete', id),
    updateFolderPath: (id: string, folderPath: string): Promise<void> =>
      ipcRenderer.invoke('projects:updateFolderPath', id, folderPath)
  },
  // Files
  files: {
    list: (projectId: string) => ipcRenderer.invoke('files:list', projectId),
    getImportGraph: (projectId: string) => ipcRenderer.invoke('files:getImportGraph', projectId),
    onChanged: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('files:changed', handler)
      return () => ipcRenderer.removeListener('files:changed', handler)
    }
  },
  // AI Accounts
  accounts: {
    list: (): Promise<AiAccount[]> => ipcRenderer.invoke('accounts:list'),
    add: (input: AddAccountInput): Promise<AiAccount> => ipcRenderer.invoke('accounts:add', input),
    setActive: (id: string): Promise<void> => ipcRenderer.invoke('accounts:setActive', id),
    remove: (id: string): Promise<void> => ipcRenderer.invoke('accounts:remove', id)
  },
  // Chats
  chats: {
    list: (projectId: string): Promise<Chat[]> => ipcRenderer.invoke('chats:list', projectId),
    create: (input: CreateChatInput): Promise<Chat> => ipcRenderer.invoke('chats:create', input)
  },
  // Knowledge Cards
  knowledge: {
    list: (projectId: string): Promise<KnowledgeCard[]> => ipcRenderer.invoke('knowledge:list', projectId),
    create: (input: CreateCardInput): Promise<KnowledgeCard> => ipcRenderer.invoke('knowledge:create', input),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('knowledge:delete', id),
    search: (projectId: string, query: string): Promise<KnowledgeCard[]> =>
      ipcRenderer.invoke('knowledge:search', projectId, query)
  },
  // Context Builder
  context: {
    assemble: (input: AssembleContextInput): Promise<string> => ipcRenderer.invoke('context:assemble', input),
    estimateTokens: (text: string): Promise<number> => ipcRenderer.invoke('context:estimateTokens', text)
  },
  // Webview injection
  webview: {
    show: (accountId: string, model: string, bounds: { x: number; y: number; width: number; height: number }): Promise<void> =>
      ipcRenderer.invoke('webview:show', accountId, model, bounds),
    hide: (accountId: string): Promise<void> => ipcRenderer.invoke('webview:hide', accountId),
    hideAll: (): Promise<void> => ipcRenderer.invoke('webview:hideAll'),
    setBounds: (bounds: { x: number; y: number; width: number; height: number }): Promise<void> =>
      ipcRenderer.invoke('webview:setBounds', bounds),
    injectContext: (accountId: string, contextBlock: string): Promise<InjectionResult> =>
      ipcRenderer.invoke('webview:injectContext', accountId, contextBlock),
    login: (accountId: string, model: string): Promise<void> =>
      ipcRenderer.invoke('webview:login', accountId, model),
    saveKnowledge: (payload: SaveKnowledgePayload): Promise<void> =>
      ipcRenderer.invoke('webview:saveKnowledge', payload),
    onKnowledgeSaved: (callback: (card: KnowledgeCard) => void) => {
      const handler = (_: unknown, card: KnowledgeCard) => callback(card)
      ipcRenderer.on('knowledge:saved', handler)
      return () => ipcRenderer.removeListener('knowledge:saved', handler)
    }
  },
  // Settings
  settings: {
    getApp: (): Promise<AppSettings> => ipcRenderer.invoke('settings:getApp'),
    setApp: (key: string, value: string): Promise<void> => ipcRenderer.invoke('settings:setApp', key, value),
    getProject: (projectId: string): Promise<ProjectSettings> =>
      ipcRenderer.invoke('settings:getProject', projectId),
    setProject: (projectId: string, input: ProjectSettingsInput): Promise<void> =>
      ipcRenderer.invoke('settings:setProject', projectId, input)
  },
  // WebSocket status
  ws: {
    onStatus: (callback: (status: WsStatus) => void) => {
      const handler = (_: unknown, status: WsStatus) => callback(status)
      ipcRenderer.on('ws:status', handler)
      return () => ipcRenderer.removeListener('ws:status', handler)
    }
  }
})
