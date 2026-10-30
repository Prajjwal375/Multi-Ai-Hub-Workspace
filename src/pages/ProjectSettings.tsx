import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore'
import { useUiStore } from '../store/uiStore'
import type { ContextMode } from '../types'

const DEFAULT_IGNORES = ['node_modules/', '.git/', 'dist/', 'build/', '.next/', 'out/', 'coverage/', '*.log', '.DS_Store']

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-primary' : 'bg-black/10'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  )
}

function SectionHeader({ icon, iconBg, iconColor, title, subtitle }: {
  icon: string; iconBg: string; iconColor: string; title: string; subtitle: string
}) {
  return (
    <div className="flex items-center gap-3 border-b border-white/30 pb-4">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconBg} ${iconColor}`}>
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      </div>
      <div>
        <h3 className="font-label-md font-semibold text-on-surface">{title}</h3>
        <p className="font-label-sm text-secondary">{subtitle}</p>
      </div>
    </div>
  )
}

// ── Change Folder Modal ───────────────────────────────────────────────────────
function ChangeFolderModal({ current, onConfirm, onClose }: { current: string; onConfirm: (path: string) => void; onClose: () => void }) {
  const [path, setPath] = useState(current)
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="glass-card rounded-2xl p-6 w-[460px] shadow-2xl">
        <h3 className="font-headline-md !text-[18px] font-bold text-on-surface mb-4">Change Connected Folder</h3>
        <p className="text-label-sm text-on-surface-variant mb-3">
          The file watcher will restart and re-index the new folder.
        </p>
        <input
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-2.5 font-mono text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 mb-4"
          autoFocus
        />
        <div className="flex gap-3">
          <button onClick={() => onConfirm(path.trim())} disabled={!path.trim() || path.trim() === current} className="flex-1 bg-primary text-white py-2.5 rounded-xl font-label-md font-semibold hover:brightness-110 transition-all disabled:opacity-50">
            Update Folder
          </button>
          <button onClick={onClose} className="px-5 py-2.5 bg-white/40 border border-white/60 rounded-xl font-label-md text-on-surface hover:bg-white/60 transition-all">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Modal ──────────────────────────────────────────────────────────────
function DeleteModal({ name, onConfirm, onClose }: { name: string; onConfirm: () => void; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="glass-card-danger rounded-2xl p-6 w-[440px] shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-error">warning</span>
          </div>
          <h3 className="font-headline-md !text-[18px] font-bold text-on-surface">Delete Project</h3>
        </div>
        <p className="text-body-md text-on-surface-variant mb-5">
          Permanently remove <span className="font-semibold text-on-surface">{name}</span> from SaKAi Hub. Your local files are
          <span className="font-medium"> not deleted</span>, but all chat history, knowledge cards, and settings will be lost.
        </p>
        <div className="flex gap-3">
          <button
            onClick={async () => { setLoading(true); await onConfirm() }}
            disabled={loading}
            className="flex-1 bg-error text-white py-2.5 rounded-xl font-label-md font-semibold hover:brightness-110 transition-all disabled:opacity-50"
          >
            {loading ? 'Deleting…' : 'Delete Project'}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 bg-white/40 border border-white/60 rounded-xl font-label-md text-on-surface hover:bg-white/60 transition-all">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Project Settings Page ─────────────────────────────────────────────────────
export function ProjectSettings() {
  const navigate = useNavigate()
  const { activeProject, deleteProject, setActiveProject } = useProjectStore()
  const wsConnected = useUiStore((s) => s.wsConnected)
  const { addToast } = useUiStore()

  const [fileCount, setFileCount] = useState(0)
  const [customIgnores, setCustomIgnores] = useState<string[]>([])
  const [defaultMode, setDefaultMode] = useState<ContextMode>('smart')
  const [maxTokens, setMaxTokens] = useState('8000')
  const [autoInclude, setAutoInclude] = useState(true)
  const [autoSync, setAutoSync] = useState(true)

  const [addingPattern, setAddingPattern] = useState(false)
  const [newPattern, setNewPattern] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const [showChangeFolder, setShowChangeFolder] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    if (!activeProject) return
    // Load file count
    window.api.files.list(activeProject.id).then((f) => setFileCount(f.length)).catch(() => {})
    // Load settings
    window.api.settings.getProject(activeProject.id).then((s) => {
      if (s) {
        setCustomIgnores(s.ignorePatterns ?? [])
        setDefaultMode(s.defaultContextMode ?? 'smart')
        setMaxTokens(String(s.maxAutoContextTokens ?? 8000))
        setAutoInclude(s.autoIncludeActiveFile ?? true)
      }
    }).catch(() => {})
  }, [activeProject?.id])

  const markDirty = () => setDirty(true)

  const handleSave = async () => {
    if (!activeProject) return
    setSaving(true)
    try {
      await window.api.settings.setProject(activeProject.id, {
        defaultContextMode: defaultMode,
        autoIncludeActiveFile: autoInclude,
        maxAutoContextTokens: parseInt(maxTokens, 10) || null,
        ignorePatterns: customIgnores,
      })
      setDirty(false)
      addToast({ type: 'success', title: 'Settings saved' })
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to save settings', message: err?.message })
    } finally {
      setSaving(false)
    }
  }

  const handleChangeFolder = async (path: string) => {
    if (!activeProject) return
    try {
      await window.api.projects.updateFolderPath(activeProject.id, path)
      setActiveProject({ ...activeProject, folderPath: path })
      setShowChangeFolder(false)
      addToast({ type: 'success', title: 'Folder updated', message: 'Re-indexing the new directory…' })
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to change folder', message: err?.message })
    }
  }

  const handleDelete = async () => {
    if (!activeProject) return
    try {
      await deleteProject(activeProject.id)
      navigate('/')
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to delete project', message: err?.message })
    }
  }

  const addPattern = () => {
    const p = newPattern.trim()
    if (p && !customIgnores.includes(p) && !DEFAULT_IGNORES.includes(p)) {
      setCustomIgnores((prev) => [...prev, p])
      markDirty()
    }
    setNewPattern('')
    setAddingPattern(false)
  }

  const removePattern = (p: string) => {
    setCustomIgnores((prev) => prev.filter((x) => x !== p))
    markDirty()
  }

  if (!activeProject) return null

  return (
    <div className="w-full h-full overflow-y-auto relative">
      {/* Sticky header */}
      <header className="glass-panel border-b border-white/70 h-[72px] px-8 flex items-center justify-between sticky top-0 z-20">
        <div>
          <h2 className="font-headline-md !text-[22px] font-semibold text-on-background">Project Settings</h2>
          <p className="font-label-sm text-tertiary mt-0.5">Settings for {activeProject.name}</p>
        </div>
      </header>

      <div className="p-8 pb-32 max-w-5xl mx-auto w-full flex flex-col gap-6">
        {/* 1. Connected Folder */}
        <section className="glass-card p-6 flex flex-col gap-4">
          <SectionHeader icon="folder" iconBg="bg-secondary-container/50" iconColor="text-primary" title="Connected Folder" subtitle="The primary local directory synced with this project." />
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-2">
            <div className="flex flex-col gap-2 bg-white/40 p-4 rounded-xl border border-white/50 flex-1 w-full">
              <code className="font-mono text-sm text-on-surface bg-white/50 px-2 py-1 rounded w-fit max-w-full truncate">{activeProject.folderPath}</code>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-amber-500'}`} />
                <span className="font-label-sm text-tertiary">
                  {wsConnected ? 'Watching' : 'Idle'} · {fileCount} files indexed
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button onClick={() => setShowChangeFolder(true)} className="px-4 py-2 rounded-lg font-label-md border border-outline-variant hover:bg-white/50 transition-colors text-on-surface">
                Change folder
              </button>
              <button onClick={() => { setActiveProject(null); navigate('/') }} className="px-4 py-2 rounded-lg font-label-md border border-error/30 text-error hover:bg-error/5 transition-colors">
                Disconnect
              </button>
            </div>
          </div>
        </section>

        {/* 2. Ignored Paths */}
        <section className="glass-card p-6 flex flex-col gap-4">
          <SectionHeader icon="visibility_off" iconBg="bg-surface-variant/50" iconColor="text-on-surface-variant" title="Ignored Paths" subtitle="Directories and files excluded from context indexing." />
          <div className="flex flex-wrap gap-2 mt-2">
            {/* Default (locked) */}
            {DEFAULT_IGNORES.map((p) => (
              <div key={p} className="flex items-center gap-1 bg-white/40 border border-white/60 pl-3 pr-3 py-1.5 rounded-full opacity-70" title="Default — always ignored">
                <span className="font-mono text-xs text-on-surface-variant">{p}</span>
                <span className="material-symbols-outlined text-[14px] text-tertiary">lock</span>
              </div>
            ))}
            {/* Custom (removable) */}
            {customIgnores.map((p) => (
              <div key={p} className="flex items-center gap-1 bg-white/60 border border-white/80 pl-3 pr-2 py-1.5 rounded-full shadow-sm">
                <span className="font-mono text-xs text-on-surface">{p}</span>
                <button onClick={() => removePattern(p)} className="text-tertiary hover:text-error transition-colors p-0.5">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            ))}
            {/* Add */}
            {addingPattern ? (
              <div className="flex items-center gap-1 bg-white/80 border border-primary pl-3 pr-1 py-1 rounded-full">
                <input
                  type="text"
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addPattern(); if (e.key === 'Escape') { setAddingPattern(false); setNewPattern('') } }}
                  onBlur={addPattern}
                  placeholder="*.tmp"
                  autoFocus
                  className="font-mono text-xs bg-transparent outline-none w-24 text-on-surface"
                />
              </div>
            ) : (
              <button onClick={() => setAddingPattern(true)} className="flex items-center gap-1 border border-dashed border-outline-variant hover:border-primary hover:bg-primary/5 text-secondary hover:text-primary px-3 py-1.5 rounded-full transition-colors">
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span className="font-label-sm">Add custom ignore pattern</span>
              </button>
            )}
          </div>
        </section>

        {/* 3. VS Code Extension */}
        <section className="glass-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-full bg-blue-100/50 flex items-center justify-center text-blue-600 mt-1">
              <span className="material-symbols-outlined">integration_instructions</span>
            </div>
            <div>
              <h3 className="font-label-md font-semibold text-on-surface flex items-center gap-3 flex-wrap">
                VS Code Extension
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${wsConnected ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  {wsConnected ? 'Connected · Port 54321' : 'Disconnected · Port 54321'}
                </span>
              </h3>
              <p className="font-body-md text-sm text-secondary mt-1">Sync active editor context in real-time.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-white/40 px-4 py-3 rounded-xl border border-white/60">
            <span className="font-label-md text-on-surface">Auto-sync</span>
            <Toggle checked={autoSync} onChange={(v) => { setAutoSync(v); window.api.settings.setApp('autoSync', String(v)).catch(() => {}) }} />
          </div>
        </section>

        {/* 4. Context Builder Defaults */}
        <section className="glass-card p-6 flex flex-col gap-4">
          <SectionHeader icon="settings_suggest" iconBg="bg-surface-variant/50" iconColor="text-on-surface-variant" title="Context Builder Defaults" subtitle="Default settings for building AI prompt context." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
            <div className="flex flex-col gap-2">
              <label className="font-label-sm text-on-surface">Selection Mode</label>
              <select
                value={defaultMode}
                onChange={(e) => { setDefaultMode(e.target.value as ContextMode); markDirty() }}
                className="bg-white/40 border border-white/50 rounded-lg px-3 py-2 text-on-surface focus:bg-white/80 focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all shadow-sm outline-none"
              >
                <option value="smart">Smart Auto</option>
                <option value="selected">Manual Selection</option>
                <option value="full">Full Directory</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-label-sm text-on-surface">Max Context Tokens</label>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => { setMaxTokens(e.target.value); markDirty() }}
                className="bg-white/40 border border-white/50 rounded-lg px-3 py-2 text-on-surface focus:bg-white/80 focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all shadow-sm outline-none font-mono"
              />
            </div>
            <div className="flex items-center justify-between bg-white/40 px-4 py-3 rounded-xl border border-white/60 md:col-span-2">
              <div>
                <span className="font-label-md text-on-surface block">Auto-include active file</span>
                <span className="font-label-sm text-tertiary">Always inject the currently focused file in VS Code into context.</span>
              </div>
              <Toggle checked={autoInclude} onChange={(v) => { setAutoInclude(v); markDirty() }} />
            </div>
          </div>
        </section>

        {/* 5. Danger Zone */}
        <section className="glass-card-danger p-6 mt-4 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h3 className="font-label-md font-semibold text-error">Delete this project</h3>
            <p className="font-body-md text-sm text-secondary mt-1 max-w-lg">
              Permanently remove this project from SaKAi Hub. This will not delete your local files, but all chat history and context settings will be lost.
            </p>
          </div>
          <button onClick={() => setShowDelete(true)} className="shrink-0 px-5 py-2.5 rounded-lg font-label-md border-2 border-error/50 text-error hover:bg-error hover:text-white transition-all shadow-sm">
            Delete Project
          </button>
        </section>
      </div>

      {/* Sticky save bar (appears when dirty) */}
      {dirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
          <div className="glass-card px-6 py-3 flex items-center gap-4 shadow-lg">
            <span className="font-label-md text-secondary">You have unsaved changes</span>
            <button onClick={handleSave} disabled={saving} className="bg-primary text-white rounded-full py-1.5 px-5 font-label-sm font-semibold hover:brightness-110 transition-all disabled:opacity-50">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showChangeFolder && <ChangeFolderModal current={activeProject.folderPath} onConfirm={handleChangeFolder} onClose={() => setShowChangeFolder(false)} />}
      {showDelete && <DeleteModal name={activeProject.name} onConfirm={handleDelete} onClose={() => setShowDelete(false)} />}
    </div>
  )
}
