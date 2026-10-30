import { create } from 'zustand'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
}

interface UiStore {
  toasts: Toast[]
  sidebarExpanded: boolean
  wsConnected: boolean

  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  setSidebarExpanded: (v: boolean) => void
  setWsConnected: (v: boolean) => void
}

let toastCounter = 0

export const useUiStore = create<UiStore>((set, get) => ({
  toasts: [],
  sidebarExpanded: false,
  wsConnected: false,

  addToast: (toast) => {
    const id = String(++toastCounter)
    set({ toasts: [...get().toasts, { ...toast, id }] })
    // Auto-dismiss after 4 seconds
    setTimeout(() => get().removeToast(id), 4000)
  },

  removeToast: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) })
  },

  setSidebarExpanded: (v) => set({ sidebarExpanded: v }),
  setWsConnected: (v) => set({ wsConnected: v }),
}))
