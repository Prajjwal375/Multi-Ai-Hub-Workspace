import { create } from 'zustand'
import type { ContextMode, ProjectFile } from '../types'

interface ContextStore {
  mode: ContextMode
  checkedFileIds: string[]
  checkedCardIds: string[]
  assembledContext: string
  tokenEstimate: number
  activeFile: ProjectFile | null

  setMode: (mode: ContextMode) => void
  toggleFile: (fileId: string) => void
  toggleCard: (cardId: string) => void
  setActiveFile: (file: ProjectFile | null) => void
  setAssembledContext: (ctx: string) => void
  setTokenEstimate: (n: number) => void
  reset: () => void
}

const initialState = {
  mode: 'smart' as ContextMode,
  checkedFileIds: [],
  checkedCardIds: [],
  assembledContext: '',
  tokenEstimate: 0,
  activeFile: null,
}

export const useContextStore = create<ContextStore>((set, get) => ({
  ...initialState,

  setMode: (mode) => set({ mode }),

  toggleFile: (fileId) => {
    const { checkedFileIds } = get()
    const exists = checkedFileIds.includes(fileId)
    set({
      checkedFileIds: exists
        ? checkedFileIds.filter((id) => id !== fileId)
        : [...checkedFileIds, fileId],
    })
  },

  toggleCard: (cardId) => {
    const { checkedCardIds } = get()
    const exists = checkedCardIds.includes(cardId)
    set({
      checkedCardIds: exists
        ? checkedCardIds.filter((id) => id !== cardId)
        : [...checkedCardIds, cardId],
    })
  },

  setActiveFile: (file) => set({ activeFile: file }),
  setAssembledContext: (ctx) => set({ assembledContext: ctx }),
  setTokenEstimate: (n) => set({ tokenEstimate: n }),

  reset: () => set(initialState),
}))
