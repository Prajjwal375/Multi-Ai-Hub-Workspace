import { create } from 'zustand'
import type { AiAccount, AddAccountInput } from '../types'

// Global store — never reset on project switch
interface AccountStore {
  accounts: AiAccount[]
  isLoading: boolean

  loadAccounts: () => Promise<void>
  addAccount: (input: AddAccountInput) => Promise<AiAccount>
  setActive: (id: string) => Promise<void>
  removeAccount: (id: string) => Promise<void>
  getActiveForModel: (model: AiAccount['model']) => AiAccount | undefined
  getByModel: (model: AiAccount['model']) => AiAccount[]
}

export const useAccountStore = create<AccountStore>((set, get) => ({
  accounts: [],
  isLoading: false,

  loadAccounts: async () => {
    set({ isLoading: true })
    try {
      const accounts = await window.api.accounts.list()
      set({ accounts, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  addAccount: async (input) => {
    const account = await window.api.accounts.add(input)
    await get().loadAccounts()
    return account
  },

  setActive: async (id) => {
    await window.api.accounts.setActive(id)
    await get().loadAccounts()
  },

  removeAccount: async (id) => {
    await window.api.accounts.remove(id)
    await get().loadAccounts()
  },

  getActiveForModel: (model) => {
    return get().accounts.find((a) => a.model === model && a.isActive)
  },

  getByModel: (model) => {
    return get().accounts.filter((a) => a.model === model)
  },
}))
