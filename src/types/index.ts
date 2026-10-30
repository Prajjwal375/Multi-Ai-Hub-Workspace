// ─── Domain Types ────────────────────────────────────────────────────────────

export interface Project {
  id: string
  name: string
  folderPath: string
  createdAt: string
  lastOpenedAt: string
}

export interface CreateProjectInput {
  name: string
  folderPath: string
}

export interface ProjectFile {
  id: string
  projectId: string
  filePath: string
  content: string
  imports: string[]
  lastModified: string
  isActive: boolean
}

export interface AiAccount {
  id: string
  model: 'claude' | 'chatgpt' | 'gemini' | 'grok'
  label: string
  sessionPartition: string
  isActive: boolean
  createdAt: string
}

export interface AddAccountInput {
  model: 'claude' | 'chatgpt' | 'gemini' | 'grok'
  label: string
}

export interface Chat {
  id: string
  projectId: string
  model: string
  accountId: string
  title: string
  createdAt: string
}

export interface CreateChatInput {
  projectId: string
  model: string
  accountId: string
}

export interface KnowledgeCard {
  id: string
  projectId: string
  content: string
  category: string | null
  tags: string[]
  sourceModel: string | null
  sourceChatId: string | null
  createdAt: string
}

export interface CreateCardInput {
  projectId: string
  content: string
  category?: string
  tags?: string[]
  sourceModel?: string
  sourceChatId?: string
}

export interface ProjectSettings {
  projectId: string
  defaultContextMode: 'smart' | 'selected' | 'full'
  autoIncludeActiveFile: boolean
  maxAutoContextTokens: number | null
  ignorePatterns: string[]
}

export interface ProjectSettingsInput {
  defaultContextMode?: 'smart' | 'selected' | 'full'
  autoIncludeActiveFile?: boolean
  maxAutoContextTokens?: number | null
  ignorePatterns?: string[]
}

export interface AppSettings {
  theme: 'light' | 'dark'
}

export type ImportGraph = Map<string, string[]>

export interface AssembleContextInput {
  mode: 'smart' | 'selected' | 'full'
  projectFiles: ProjectFile[]
  activeFile?: ProjectFile
  importGraph: ImportGraph
  checkedFileIds: string[]
  checkedCardIds: string[]
  knowledgeCards: KnowledgeCard[]
  ignorePatterns: string[]
  maxTokens?: number
  userMessage?: string
  projectName?: string
}

export interface InjectionResult {
  success: boolean
  method: 'executeJavaScript' | 'clipboard'
  error?: string
}

export interface SaveKnowledgePayload {
  content: string
  sourceModel: string
  sourceChatId?: string
}

export type WsStatus = { connected: boolean; projectId?: string }

export type ContextMode = 'smart' | 'selected' | 'full'

export type ProviderModel = 'claude' | 'chatgpt' | 'gemini' | 'grok'

// ─── IPC Error ───────────────────────────────────────────────────────────────

export interface IpcError {
  code: 'VALIDATION' | 'NOT_FOUND' | 'DUPLICATE' | 'DB_ERROR' | 'FS_ERROR' | 'INJECTION_FAILED'
  message: string
  field?: string
}

// ─── Provider Config ─────────────────────────────────────────────────────────

export const PROVIDER_CONFIG: Record<
  ProviderModel,
  { label: string; url: string; color: string; contextWindow: number }
> = {
  claude: {
    label: 'Claude',
    url: 'https://claude.ai',
    color: '#D4A27F',
    contextWindow: 200_000,
  },
  chatgpt: {
    label: 'ChatGPT',
    url: 'https://chatgpt.com',
    color: '#74AA9C',
    contextWindow: 128_000,
  },
  gemini: {
    label: 'Gemini',
    url: 'https://gemini.google.com',
    color: '#4285F4',
    contextWindow: 1_000_000,
  },
  grok: {
    label: 'Grok',
    url: 'https://grok.com',
    color: '#1DA1F2',
    contextWindow: 131_072,
  },
}
