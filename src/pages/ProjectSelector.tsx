import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore'
import { useUiStore } from '../store/uiStore'
import type { Project } from '../types'

// Cycling accent colors for project cards
const ACCENTS = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ec4899', '#06b6d4']
const ICONS = ['💠', '🍃', '🌍', '⚡', '🚀', '🧩']

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs === 1 ? '1 hour ago' : `${hrs} hours ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString()
}

// ── Create Project Modal ──────────────────────────────────────────────────────
function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { createProject, openProject } = useProjectStore()
  const { addToast } = useUiStore()

  const [name, setName] = useState('')
  const [folderPath, setFolderPath] = useState('')
  const [nameErr, setNameErr] = useState('')
  const [pathErr, setPathErr] = useState('')
  const [loading, setLoading] = useState(false)

  const validate = () => {
    let ok = true
    setNameErr('')
    setPathErr('')
    if (!name.trim()) { setNameErr('Project name is required'); ok = false }
    else if (name.trim().length > 100) { setNameErr('Name must be 100 characters or fewer'); ok = false }
    if (!folderPath.trim()) { setPathErr('Folder path is required'); ok = false }
    return ok
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const project = await createProject(name.trim(), folderPath.trim())
      await openProject(project.id)
      navigate(`/project/${project.id}/dashboard`)
    } catch (err: any) {
      const msg = String(err?.message || err)
      if (msg.toLowerCase().includes('folder') || msg.includes('FS_ERROR') || msg.toLowerCase().includes('path')) {
        setPathErr('Folder path does not exist on disk')
      } else {
        addToast({ type: 'error', title: 'Failed to create project', message: msg })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass-card rounded-2xl p-6 w-[440px] shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-headline-md !text-[20px] font-bold text-on-surface">Create New Project</h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="text-label-sm text-on-surface-variant block mb-1.5">
              Project Name <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameErr('') }}
              placeholder="My Awesome Project"
              maxLength={100}
              autoFocus
              className={`w-full bg-white/50 border rounded-xl px-4 py-2.5 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 transition-all ${
                nameErr ? 'border-error focus:ring-error/30' : 'border-white/60 focus:ring-primary/40'
              }`}
            />
            {nameErr && <p className="text-[11px] text-error mt-1">{nameErr}</p>}
          </div>
          <div>
            <label className="text-label-sm text-on-surface-variant block mb-1.5">
              Folder Path <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={folderPath}
              onChange={(e) => { setFolderPath(e.target.value); setPathErr('') }}
              placeholder="D:\Projects\my-project"
              className={`w-full bg-white/50 border rounded-xl px-4 py-2.5 font-mono text-sm text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 transition-all ${
                pathErr ? 'border-error focus:ring-error/30' : 'border-white/60 focus:ring-primary/40'
              }`}
            />
            {pathErr && <p className="text-[11px] text-error mt-1">{pathErr}</p>}
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary text-white py-2.5 rounded-xl font-label-md font-semibold hover:brightness-110 transition-all disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create Project'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-white/40 border border-white/60 rounded-xl font-label-md text-on-surface hover:bg-white/60 transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Project Card ──────────────────────────────────────────────────────────────
function ProjectCard({
  project,
  accent,
  icon,
  chatCount,
  staggerIdx,
  onOpen,
  onRename,
  onDelete,
}: {
  project: Project
  accent: string
  icon: string
  chatCount: number | null
  staggerIdx: number
  onOpen: (id: string) => void
  onRename: (project: Project) => void
  onDelete: (project: Project) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      onClick={() => onOpen(project.id)}
      className={`glass-card rounded-[14px] p-6 flex flex-col gap-4 group cursor-pointer relative stagger-${staggerIdx} hover:-translate-y-1 transition-transform`}
      style={{ borderLeftWidth: '4px', borderLeftColor: accent }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
            style={{ backgroundColor: accent + '1a' }}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="font-headline-md !text-[18px] text-on-surface truncate">{project.name}</h3>
            {chatCount !== null && (
              <span className="glass-pill px-2 py-0.5 rounded-full text-[10px] font-bold text-primary inline-block mt-0.5">
                {chatCount} {chatCount === 1 ? 'CHAT' : 'CHATS'}
              </span>
            )}
          </div>
        </div>
        {/* Menu */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-on-surface-variant hover:text-primary transition-colors p-2 rounded-lg hover:bg-white/40"
          >
            <span className="material-symbols-outlined">more_vert</span>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 glass-card rounded-xl py-1 w-36 shadow-xl">
                <button
                  onClick={() => { setMenuOpen(false); onRename(project) }}
                  className="w-full text-left px-3 py-2 text-sm text-on-surface hover:bg-white/40 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span> Rename
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onDelete(project) }}
                  className="w-full text-left px-3 py-2 text-sm text-error hover:bg-error/10 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1 flex-grow mt-1">
        <p className="font-mono text-[12px] text-on-surface-variant opacity-70 truncate" title={project.folderPath}>
          {project.folderPath}
        </p>
        <p className="text-label-sm text-on-surface-variant opacity-60">
          Last opened: {relativeTime(project.lastOpenedAt)}
        </p>
      </div>

      <div className="mt-2 pt-4 border-t border-white/30 flex items-center gap-1.5 text-[12px] text-[#22c55e]">
        <span className="material-symbols-outlined text-[14px]">folder</span> Connected
      </div>
    </div>
  )
}

// ── Rename Modal ──────────────────────────────────────────────────────────────
function RenameModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const { renameProject } = useProjectStore()
  const { addToast } = useUiStore()
  const [name, setName] = useState(project.name)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || name.trim().length > 100) return
    setLoading(true)
    try {
      await renameProject(project.id, name.trim())
      addToast({ type: 'success', title: 'Project renamed' })
      onClose()
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to rename', message: err?.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass-card rounded-2xl p-6 w-[400px] shadow-2xl">
        <h3 className="font-headline-md !text-[18px] font-bold text-on-surface mb-4">Rename Project</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            autoFocus
            className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="flex gap-3">
            <button type="submit" disabled={loading || !name.trim()} className="flex-1 bg-primary text-white py-2.5 rounded-xl font-label-md font-semibold hover:brightness-110 transition-all disabled:opacity-50">
              {loading ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-white/40 border border-white/60 rounded-xl font-label-md text-on-surface hover:bg-white/60 transition-all">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────
function DeleteModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const { deleteProject } = useProjectStore()
  const { addToast } = useUiStore()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      await deleteProject(project.id)
      addToast({ type: 'info', title: 'Project deleted', message: 'Files on disk were not touched.' })
      onClose()
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to delete', message: err?.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass-card-danger rounded-2xl p-6 w-[420px] shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-error">warning</span>
          </div>
          <h3 className="font-headline-md !text-[18px] font-bold text-on-surface">Delete Project</h3>
        </div>
        <p className="text-body-md text-on-surface-variant mb-5">
          Delete <span className="font-semibold text-on-surface">{project.name}</span>? This removes its file mirror,
          knowledge cards, and chat history from SaKAi Hub. <span className="font-medium">Your files on disk are not affected.</span>
        </p>
        <div className="flex gap-3">
          <button onClick={handleDelete} disabled={loading} className="flex-1 bg-error text-white py-2.5 rounded-xl font-label-md font-semibold hover:brightness-110 transition-all disabled:opacity-50">
            {loading ? 'Deleting…' : 'Delete Project'}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 bg-white/40 border border-white/60 rounded-xl font-label-md text-on-surface hover:bg-white/60 transition-all">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Project Selector Page ─────────────────────────────────────────────────────
export function ProjectSelector() {
  const navigate = useNavigate()
  const { projects, loadProjects, openProject } = useProjectStore()
  const { addToast } = useUiStore()

  const [showCreate, setShowCreate] = useState(false)
  const [renaming, setRenaming] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState<Project | null>(null)
  const [chatCounts, setChatCounts] = useState<Record<string, number>>({})
  const [firstLoadDone, setFirstLoadDone] = useState(false)

  useEffect(() => {
    loadProjects().finally(() => setFirstLoadDone(true))
  }, [])

  // Fetch chat counts per project (background)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const counts: Record<string, number> = {}
      await Promise.all(
        projects.map(async (p) => {
          try {
            const chats = await window.api.chats.list(p.id)
            counts[p.id] = chats.length
          } catch {
            counts[p.id] = 0
          }
        })
      )
      if (!cancelled) setChatCounts(counts)
    })()
    return () => { cancelled = true }
  }, [projects])

  const handleOpen = async (id: string) => {
    try {
      await openProject(id)
      navigate(`/project/${id}/dashboard`)
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to open project', message: err?.message })
    }
  }

  const hasProjects = projects.length > 0

  return (
    <div className="w-full h-full overflow-y-auto">
      {/* Top brand bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 lg:px-10 py-4 backdrop-blur-md bg-white/10 border-b border-white/20">
        <div className="flex items-center gap-3">
          <BrandMark size={36} />
          <div className="leading-tight">
            <p className="font-bold text-[16px] text-on-surface">SaKAi Hub</p>
            <p className="text-[11px] text-on-surface-variant -mt-0.5">Multi-AI workspace</p>
          </div>
        </div>
        {hasProjects && (
          <button
            onClick={() => setShowCreate(true)}
            className="bg-primary text-white px-5 py-2.5 rounded-xl font-label-md flex items-center gap-2 shadow-lg shadow-primary/25 hover:scale-[1.03] active:scale-[0.98] transition-all"
          >
            <span className="material-symbols-outlined text-lg">add</span> New Project
          </button>
        )}
      </header>

      <div className="max-w-[1200px] mx-auto px-6 lg:px-10">
        {!firstLoadDone ? (
          // ── Loading gate (prevents empty-state flash before data loads) ──
          <div className="flex flex-col items-center justify-center text-center py-32">
            <div className="relative mb-6">
              <div className="absolute inset-0 blur-3xl opacity-30 bg-gradient-to-br from-primary to-indigo-500 rounded-full scale-150" />
              <BrandMark size={72} className="relative animate-pulse" />
            </div>
            <p className="text-on-surface-variant font-body-md">Loading your workspaces…</p>
          </div>
        ) : hasProjects ? (
          // ── Populated state ───────────────────────────────────────────
          <>
            <div className="pt-10 pb-6">
              <h2 className="text-display-lg !text-[34px] font-bold text-on-surface">Your Projects</h2>
              <p className="font-body-lg text-on-surface-variant mt-1">
                {projects.length} workspace{projects.length === 1 ? '' : 's'} · pick one to continue or start fresh
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
              {projects.map((project, idx) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  accent={ACCENTS[idx % ACCENTS.length]}
                  icon={ICONS[idx % ICONS.length]}
                  chatCount={chatCounts[project.id] ?? null}
                  staggerIdx={(idx % 4) + 1}
                  onOpen={handleOpen}
                  onRename={setRenaming}
                  onDelete={setDeleting}
                />
              ))}

              {/* Create new card */}
              <button
                onClick={() => setShowCreate(true)}
                className="create-card rounded-[14px] p-6 flex flex-col items-center justify-center gap-4 cursor-pointer group min-h-[180px]"
              >
                <div className="w-14 h-14 rounded-full flex items-center justify-center bg-white/30 border border-white/40 group-hover:scale-110 transition-transform shadow-lg">
                  <span className="material-symbols-outlined text-3xl text-primary">add</span>
                </div>
                <span className="font-headline-md !text-[16px] text-on-surface-variant group-hover:text-primary transition-colors">
                  Create New Project
                </span>
              </button>
            </div>

            {/* Feature strip */}
            <FeatureStrip />
            <FooterNote />
          </>
        ) : (
          // ── Empty / welcome state ─────────────────────────────────────
          <div className="flex flex-col items-center text-center pt-16 pb-12">
            {/* Hero */}
            <div className="relative mb-6">
              <div className="absolute inset-0 blur-3xl opacity-40 bg-gradient-to-br from-primary to-indigo-500 rounded-full scale-150" />
              <BrandMark size={84} className="relative" />
            </div>

            <h1 className="text-display-lg text-on-surface max-w-2xl">
              One shared memory for <span className="text-primary">every AI</span>
            </h1>
            <p className="font-body-lg text-on-surface-variant mt-4 max-w-xl">
              SaKAi Hub keeps Claude, ChatGPT, Gemini & Grok in sync with your codebase — so you
              never have to re-explain your project again.
            </p>

            <div className="flex items-center gap-3 mt-8">
              <button
                onClick={() => setShowCreate(true)}
                className="bg-primary text-white px-7 py-3.5 rounded-2xl font-label-md font-semibold text-[15px] flex items-center gap-2 shadow-xl shadow-primary/30 hover:scale-[1.03] active:scale-[0.98] transition-all"
              >
                <span className="material-symbols-outlined">add</span>
                Create your first project
              </button>
            </div>

            <p className="text-label-sm text-on-surface-variant/70 mt-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">lock</span>
              Local-first · No API keys · Your code never leaves your machine
            </p>

            {/* Feature highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-14 w-full max-w-4xl">
              <FeatureCard
                icon="psychology"
                color="#a855f7"
                title="Shared AI Memory"
                desc="Every model reads the same assembled project context and knowledge base."
                delay={1}
              />
              <FeatureCard
                icon="sync"
                color="#3b82f6"
                title="Live VS Code Sync"
                desc="Your active file streams into context in real time as you work."
                delay={2}
              />
              <FeatureCard
                icon="hub"
                color="#22c55e"
                title="One Hub, Four AIs"
                desc="Switch between Claude, ChatGPT, Gemini & Grok without losing context."
                delay={3}
              />
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
      {renaming && <RenameModal project={renaming} onClose={() => setRenaming(null)} />}
      {deleting && <DeleteModal project={deleting} onClose={() => setDeleting(null)} />}
    </div>
  )
}

// ── Brand mark ────────────────────────────────────────────────────────────────
function BrandMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      className={`rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 ${className}`}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #0058be 0%, #4f46e5 60%, #7c3aed 100%)',
      }}
    >
      <span
        className="material-symbols-outlined text-white"
        style={{ fontSize: size * 0.55, fontVariationSettings: "'FILL' 1" }}
      >
        hub
      </span>
    </div>
  )
}

// ── Feature card (empty state) ──────────────────────────────────────────────────
function FeatureCard({
  icon, color, title, desc, delay,
}: {
  icon: string
  color: string
  title: string
  desc: string
  delay: number
}) {
  return (
    <div className={`glass-card rounded-2xl p-6 text-left flex flex-col gap-3 stagger-${delay} hover:-translate-y-1 transition-transform`}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '1f', color }}>
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      </div>
      <h3 className="font-headline-md !text-[16px] font-semibold text-on-surface">{title}</h3>
      <p className="text-label-md text-on-surface-variant leading-relaxed">{desc}</p>
    </div>
  )
}

// ── Feature strip (populated state) ─────────────────────────────────────────────
function FeatureStrip() {
  const items = [
    { icon: 'psychology', color: '#a855f7', title: 'Shared AI Memory', desc: 'One context for every model' },
    { icon: 'sync', color: '#3b82f6', title: 'Live VS Code Sync', desc: 'Your active file, in real time' },
    { icon: 'lock', color: '#22c55e', title: 'Local-First', desc: 'All data stays on your machine' },
  ]
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-5 pb-12">
      {items.map((it) => (
        <div key={it.title} className="glass-panel p-4 rounded-2xl flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: it.color + '1f', color: it.color }}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{it.icon}</span>
          </div>
          <div>
            <p className="font-label-md font-bold text-on-surface">{it.title}</p>
            <p className="font-label-sm text-on-surface-variant">{it.desc}</p>
          </div>
        </div>
      ))}
    </section>
  )
}

function FooterNote() {
  return (
    <p className="text-center text-label-sm text-on-surface-variant/60 pb-10 flex items-center justify-center gap-2">
      <span className="material-symbols-outlined text-[15px]">lock</span>
      Local-first · No API keys · Your code never leaves your machine
    </p>
  )
}
