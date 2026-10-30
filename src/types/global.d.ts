import type {
  Project,
  CreateProjectInput,
  AiAccount,
  AddAccountInput,
  Chat,
  CreateChatInput,
  KnowledgeCard,
  CreateCardInput,
  ProjectSettings,
  ProjectSettingsInput,
  AppSettings,
  AssembleContextInput,
  InjectionResult,
  SaveKnowledgePayload,
  WsStatus,
} from './index'

declare global {
  interface Window {
    api: {
      projects: {
        list(): Promise<Project[]>
        create(input: CreateProjectInput): Promise<Project>
        open(id: string): Promise<Project>
        rename(id: string, name: string): Promise<void>
        delete(id: string): Promise<void>
        updateFolderPath(id: string, folderPath: string): Promise<void>
      }
      files: {
        list(projectId: string): Promise<import('./index').ProjectFile[]>
        getImportGraph(projectId: string): Promise<[string, string[]][]>
        onChanged(callback: () => void): () => void
      }
      accounts: {
        list(): Promise<AiAccount[]>
        add(input: AddAccountInput): Promise<AiAccount>
        setActive(id: string): Promise<void>
        remove(id: string): Promise<void>
      }
      chats: {
        list(projectId: string): Promise<Chat[]>
        create(input: CreateChatInput): Promise<Chat>
      }
      knowledge: {
        list(projectId: string): Promise<KnowledgeCard[]>
        create(input: CreateCardInput): Promise<KnowledgeCard>
        delete(id: string): Promise<void>
        search(projectId: string, query: string): Promise<KnowledgeCard[]>
      }
      context: {
        assemble(input: AssembleContextInput): Promise<string>
        estimateTokens(text: string): Promise<number>
      }
      webview: {
        show(accountId: string, model: string, bounds: { x: number; y: number; width: number; height: number }): Promise<void>
        hide(accountId: string): Promise<void>
        hideAll(): Promise<void>
        setBounds(bounds: { x: number; y: number; width: number; height: number }): Promise<void>
        injectContext(accountId: string, contextBlock: string): Promise<InjectionResult>
        login(accountId: string, model: string): Promise<void>
        saveKnowledge(payload: SaveKnowledgePayload): Promise<void>
        onKnowledgeSaved(callback: (card: KnowledgeCard) => void): () => void
      }
      settings: {
        getApp(): Promise<AppSettings>
        setApp(key: string, value: string): Promise<void>
        getProject(projectId: string): Promise<ProjectSettings>
        setProject(projectId: string, input: ProjectSettingsInput): Promise<void>
      }
      ws: {
        onStatus(callback: (status: WsStatus) => void): () => void
      }
    }
  }
}
