import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore'
import { useKnowledgeStore } from '../store/knowledgeStore'
import { useContextStore } from '../store/contextStore'
import { useUiStore } from '../store/uiStore'
import type { KnowledgeCard } from '../types'

// Category → pill colors
const CATEGORY_STYLES: Record<string, string> = {
  authentication: 'bg-violet-100 text-violet-700 border-violet-200',
  architecture: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  frontend: 'bg-amber-100 text-amber-700 border-amber-200',
  backend: 'bg-green-100 text-green-700 border-green-200',
  security: 'bg-red-100 text-red-700 border-red-200',
}
function catStyle(category: string | null): string {
  if (!category) return 'bg-blue-100 text-blue-700 border-blue-200'
  return CATEGORY_STYLES[category.toLowerCase()] ?? 'bg-blue-100 text-blue-700 border-blue-200'
}

const MODEL_DOT: Record<string, string> = {
  claude: 'bg-orange-500',
  chatgpt: 'bg-green-500',
  gemini: 'bg-blue-500',
  grok: 'bg-black',
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs < 6 ? `${hrs}h ago` : 'today'
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString()
}

// ── Add Note Modal ────────────────────────────────────────────────────────────
function AddNoteModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { createCard } = useKnowledgeStore()
  const { addToast } = useUiStore()
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (!content.trim()) { setErr('Content is required'); return }
    if (content.length > 10000) { setErr('Content must be 10,000 characters or fewer'); return }
    setLoading(true)
    try {
      await createCard({
        projectId,
        content: content.trim(),
        category: category.trim() || undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      })
      addToast({ type: 'success', title: 'Knowledge card saved' })
      onClose()
    } catch (e: any) {
      addToast({ type: 'error', title: 'Failed to save card', message: e?.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="glass-card rounded-2xl p-6 w-[480px] shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-headline-md !text-[18px] font-bold text-on-surface">New Knowledge Card</h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface"><span className="material-symbols-outlined">close</span></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="text-label-sm text-on-surface-variant block mb-1.5">Content <span className="text-error">*</span></label>
            <textarea
              value={content}
              onChange={(e) => { setContent(e.target.value); setErr('') }}
              placeholder="Paste an AI response or write a note…"
              rows={6}
              maxLength={10000}
              autoFocus
              className={`w-full bg-white/50 border rounded-xl px-4 py-2.5 text-on-surface placeholder-on-surface-variant/50 resize-y focus:outline-none focus:ring-2 transition-all ${err ? 'border-error focus:ring-error/30' : 'border-white/60 focus:ring-primary/40'}`}
            />
            <div className="flex justify-between mt-1">
              {err && <p className="text-[11px] text-error">{err}</p>}
              <span className="text-[11px] text-on-surface-variant/60 ml-auto">{content.length} / 10,000</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-label-sm text-on-surface-variant block mb-1.5">Category</label>
              <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Architecture" className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-2.5 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div>
              <label className="text-label-sm text-on-surface-variant block mb-1.5">Tags (comma-separated)</label>
              <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="jwt, security" className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-2.5 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={loading} className="flex-1 bg-primary text-white py-2.5 rounded-xl font-label-md font-semibold hover:brightness-110 transition-all disabled:opacity-50">
              {loading ? 'Saving…' : 'Save Card'}
            </button>
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-white/40 border border-white/60 rounded-xl font-label-md text-on-surface hover:bg-white/60 transition-all">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
function Card({
  card, selected, staggerIdx, onSelect, onInject, onDelete,
}: {
  card: KnowledgeCard
  selected: boolean
  staggerIdx: number
  onSelect: (id: string) => void
  onInject: (card: KnowledgeCard) => void
  onDelete: (card: KnowledgeCard) => void
}) {
  return (
    <div className={`glass-card p-6 flex flex-col gap-4 group relative overflow-hidden pl-10 opacity-0 animate-fade-in-up stagger-${staggerIdx} ${selected ? 'ring-2 ring-primary/40' : ''}`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onSelect(card.id)}
        className={`absolute top-6 left-4 rounded border-white/50 text-primary focus:ring-primary w-4 h-4 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        aria-label="Select card"
      />
      <div className="flex justify-between items-start">
        <span className={`inline-block px-3 py-1 rounded-full text-[12px] font-semibold border ${catStyle(card.category)}`}>
          {card.category || 'General'}
        </span>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onInject(card)} className="text-secondary hover:text-primary transition-colors p-1 rounded-md hover:bg-white/50" title="Inject into context">
            <span className="material-symbols-outlined text-[20px]">input</span>
          </button>
          <button onClick={() => onDelete(card)} className="text-secondary hover:text-error transition-colors p-1 rounded-md hover:bg-white/50" title="Delete card">
            <span className="material-symbols-outlined text-[20px]">delete</span>
          </button>
        </div>
      </div>
      <p className="font-body-lg text-body-lg text-on-surface whitespace-pre-wrap break-words">{card.content}</p>
      <div className="flex items-center justify-between mt-2 pt-4 border-t border-white/40">
        <div className="flex items-center gap-2.5">
          {card.sourceModel ? (
            <span className={`w-6 h-6 rounded-full flex items-center justify-center ${MODEL_DOT[card.sourceModel] ?? 'bg-slate-400'}`}>
              <span className="material-symbols-outlined text-white text-[14px]">smart_toy</span>
            </span>
          ) : (
            <span className="w-6 h-6 rounded-full bg-slate-300 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[14px]">edit_note</span>
            </span>
          )}
          <span className="font-label-sm text-label-sm text-secondary">Saved {relativeTime(card.createdAt)}</span>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {card.tags.map((tag) => (
            <span key={tag} className="text-[11px] px-2 py-0.5 rounded bg-white/40 text-secondary">{tag}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Knowledge Base Page ───────────────────────────────────────────────────────
export function KnowledgeBase() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { activeProject } = useProjectStore()
  const { cards, filteredCards, searchQuery, filterCategory, loadCards, deleteCard, search, setFilterCategory } = useKnowledgeStore()
  const { toggleCard, checkedCardIds } = useContextStore()
  const { addToast } = useUiStore()

  const [showAdd, setShowAdd] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (activeProject) loadCards(activeProject.id)
  }, [activeProject?.id])

  // Distinct categories for filter pills
  const categories = useMemo(
    () => [...new Set(cards.map((c) => c.category).filter(Boolean))] as string[],
    [cards]
  )

  const handleSearch = (q: string) => {
    if (!activeProject) return
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => search(activeProject.id, q), 150)
  }

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))

  const handleInject = (card: KnowledgeCard) => {
    if (!checkedCardIds.includes(card.id)) toggleCard(card.id)
    addToast({ type: 'success', title: 'Added to context', message: 'Open the Chat workspace to inject it.' })
  }

  const handleDelete = async (card: KnowledgeCard) => {
    try {
      await deleteCard(card.id)
      setSelectedIds((prev) => prev.filter((i) => i !== card.id))
      addToast({ type: 'info', title: 'Card deleted' })
    } catch {
      addToast({ type: 'error', title: 'Failed to delete card' })
    }
  }

  const handleBulkInject = () => {
    selectedIds.forEach((cid) => { if (!checkedCardIds.includes(cid)) toggleCard(cid) })
    addToast({ type: 'success', title: `${selectedIds.length} cards added to context` })
    setSelectedIds([])
    if (id) navigate(`/project/${id}/chat`)
  }

  const handleBulkDelete = async () => {
    for (const cid of selectedIds) {
      try { await deleteCard(cid) } catch {}
    }
    addToast({ type: 'info', title: `${selectedIds.length} cards deleted` })
    setSelectedIds([])
  }

  return (
    <div className="w-full h-full overflow-y-auto relative">
      <div className="max-w-[1440px] mx-auto p-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-[22px] font-semibold text-on-surface">Knowledge Base</h2>
            <p className="font-body-md text-secondary">Saved insights for this project</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[20px]">search</span>
              <input
                type="text"
                defaultValue={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search knowledge…"
                className="glass-input pl-10 pr-4 py-2 rounded-full w-full md:w-64 text-body-md text-on-surface placeholder:text-secondary"
              />
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="bg-primary text-white rounded-full py-2 px-5 font-label-md hover:brightness-110 transition-all flex items-center gap-2 whitespace-nowrap shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add manual note
            </button>
          </div>
        </header>

        {/* Filter pills */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-8">
            <button
              onClick={() => setFilterCategory(null)}
              className={`glass-panel px-5 py-2 rounded-full font-label-md transition-colors ${!filterCategory ? 'bg-blue-custom/10 text-primary border-primary/20' : 'text-secondary hover:bg-white/65'}`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`glass-panel px-5 py-2 rounded-full font-label-md transition-colors ${filterCategory === cat ? 'bg-blue-custom/10 text-primary border-primary/20' : 'text-secondary hover:bg-white/65'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Cards */}
        {filteredCards.length === 0 ? (
          <div className="text-center py-24">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/30">psychology</span>
            <p className="text-on-surface-variant mt-3 font-medium">No knowledge cards yet</p>
            <p className="text-on-surface-variant/60 text-sm mt-1">
              Save AI responses from the chat, or click "Add manual note" to create one.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pb-28">
            {filteredCards.map((card, idx) => (
              <Card
                key={card.id}
                card={card}
                selected={selectedIds.includes(card.id)}
                staggerIdx={(idx % 3) + 1}
                onSelect={toggleSelect}
                onInject={handleInject}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating action bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
          <div className="glass-card px-6 py-3 flex items-center gap-4 shadow-lg">
            <span className="font-label-md text-secondary">
              {selectedIds.length} card{selectedIds.length > 1 ? 's' : ''} selected
            </span>
            <span className="text-on-surface-variant/40">•</span>
            <button onClick={handleBulkInject} className="bg-primary text-white rounded-full py-1.5 px-4 font-label-sm hover:brightness-110 transition-all flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">input</span>
              Inject into chat
            </button>
            <button onClick={handleBulkDelete} className="font-label-sm text-error hover:text-red-700 transition-colors">
              Delete selected
            </button>
            <button onClick={() => setSelectedIds([])} className="text-on-surface-variant hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
      )}

      {/* Add note modal */}
      {showAdd && activeProject && <AddNoteModal projectId={activeProject.id} onClose={() => setShowAdd(false)} />}
    </div>
  )
}
