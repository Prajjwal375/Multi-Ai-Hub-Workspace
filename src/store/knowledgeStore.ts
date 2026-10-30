import { create } from 'zustand'
import type { KnowledgeCard, CreateCardInput } from '../types'

// Per-project store — reset on project switch
interface KnowledgeStore {
  cards: KnowledgeCard[]
  filteredCards: KnowledgeCard[]
  searchQuery: string
  filterCategory: string | null
  isLoading: boolean

  loadCards: (projectId: string) => Promise<void>
  createCard: (input: CreateCardInput) => Promise<KnowledgeCard>
  deleteCard: (id: string) => Promise<void>
  search: (projectId: string, query: string) => Promise<void>
  setFilterCategory: (category: string | null) => void
  reset: () => void
}

const initialState = {
  cards: [],
  filteredCards: [],
  searchQuery: '',
  filterCategory: null,
  isLoading: false,
}

export const useKnowledgeStore = create<KnowledgeStore>((set, get) => ({
  ...initialState,

  loadCards: async (projectId) => {
    set({ isLoading: true })
    try {
      const cards = await window.api.knowledge.list(projectId)
      set({ cards, filteredCards: cards, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  createCard: async (input) => {
    const card = await window.api.knowledge.create(input)
    const cards = [...get().cards, card]
    set({ cards, filteredCards: applyFilters(cards, get().searchQuery, get().filterCategory) })
    return card
  },

  deleteCard: async (id) => {
    await window.api.knowledge.delete(id)
    const cards = get().cards.filter((c) => c.id !== id)
    set({ cards, filteredCards: applyFilters(cards, get().searchQuery, get().filterCategory) })
  },

  search: async (projectId, query) => {
    set({ searchQuery: query })
    if (!query.trim()) {
      set({ filteredCards: applyFilters(get().cards, '', get().filterCategory) })
      return
    }
    try {
      const results = await window.api.knowledge.search(projectId, query)
      set({ filteredCards: applyFilters(results, query, get().filterCategory) })
    } catch {
      // fallback: client-side filter
      set({ filteredCards: applyFilters(get().cards, query, get().filterCategory) })
    }
  },

  setFilterCategory: (category) => {
    set({ filterCategory: category })
    set({ filteredCards: applyFilters(get().cards, get().searchQuery, category) })
  },

  reset: () => set(initialState),
}))

function applyFilters(
  cards: KnowledgeCard[],
  query: string,
  category: string | null
): KnowledgeCard[] {
  let result = cards
  if (category) {
    result = result.filter((c) => c.category === category)
  }
  if (query.trim()) {
    const q = query.toLowerCase()
    result = result.filter(
      (c) =>
        c.content.toLowerCase().includes(q) ||
        c.category?.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
    )
  }
  return result
}
