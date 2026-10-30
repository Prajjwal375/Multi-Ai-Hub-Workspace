import React, { useEffect, useRef, useCallback, useState } from 'react'
import { useContextStore } from '../store/contextStore'
import { useKnowledgeStore } from '../store/knowledgeStore'
import { useProjectStore } from '../store/projectStore'
import { PROVIDER_CONFIG, type ContextMode, type ProjectFile, type ProviderModel } from '../types'

const MODES: { id: ContextMode; label: string }[] = [
  { id: 'smart', label: 'Smart Auto' },
  { id: 'selected', label: 'Selected' },
  { id: 'full', label: 'Full' },
]

function fileIcon(path: string): string {
  if (/\.(ts|tsx)$/.test(path)) return 'code'
  if (/\.(js|jsx)$/.test(path)) return 'javascript'
  if (/\.(css|scss)$/.test(path)) return 'css'
  if (/\.(json)$/.test(path)) return 'data_object'
  if (/\.(md)$/.test(path)) return 'description'
  return 'draft'
}

function shortName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

interface Props {
  projectFiles: ProjectFile[]
  activeModel: ProviderModel
  onInject: () => void
}

export function ContextPanel({ projectFiles, activeModel, onInject }: Props) {
  const {
    mode, setMode,
    checkedFileIds, toggleFile,
    checkedCardIds, toggleCard,
    tokenEstimate, setTokenEstimate,
  } = useContextStore()
  const { cards } = useKnowledgeStore()
  const { activeProject } = useProjectStore()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeFile = projectFiles.find((f) => f.isActive) ?? null

  // Imported files = files imported by the active file (resolved paths in active file's imports)
  const importedFiles = activeFile
    ? projectFiles.filter(
        (f) =>
          activeFile.imports.includes(f.filePath) && f.id !== activeFile.id
      )
    : []

  // Recently changed = last 30 min, excluding active file
  const cutoff = Date.now() - 30 * 60 * 1000
  const recentlyChanged = projectFiles.filter(
    (f) => new Date(f.lastModified).getTime() >= cutoff && f.id !== activeFile?.id
  )

  const limit = PROVIDER_CONFIG[activeModel].contextWindow
  const [calculating, setCalculating] = useState(false)
  // True percentage (uncapped) so the user sees how far over they actually are
  const rawPct = limit > 0 ? Math.round((tokenEstimate / limit) * 100) : 0
  const barPct = Math.min(100, rawPct)
  const barColor = rawPct >= 100 ? 'bg-error' : rawPct >= 80 ? 'bg-amber-500' : 'bg-primary'
  const pctColor = rawPct >= 100 ? 'text-error' : rawPct >= 80 ? 'text-amber-600' : 'text-primary'

  // Live token estimate — measured against the REAL assembled context block
  // (same output that gets injected), so the count + % are accurate.
  const estimate = useCallback(async () => {
    setCalculating(true)
    try {
      const importGraph = new Map<string, string[]>(
        projectFiles.map((f) => [f.filePath, f.imports])
      )
      const block = await window.api.context.assemble({
        mode,
        projectFiles,
        activeFile: activeFile ?? undefined,
        importGraph,
        checkedFileIds,
        checkedCardIds,
        knowledgeCards: cards,
        ignorePatterns: [],
        projectName: activeProject?.name,
      })
      const n = await window.api.context.estimateTokens(block)
      setTokenEstimate(n)
    } catch {
      setTokenEstimate(0)
    } finally {
      setCalculating(false)
    }
  }, [mode, projectFiles, checkedFileIds, checkedCardIds, cards, activeFile, activeProject?.name])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(estimate, 150)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [estimate])

  const Checkbox = ({ checked }: { checked: boolean }) => (
    <span className={`material-symbols-outlined text-[18px] ${checked ? 'text-primary' : 'text-on-surface-variant'}`}>
      {checked ? 'check_box' : 'check_box_outline_blank'}
    </span>
  )

  return (
    <aside className="w-[280px] h-full glass-panel flex flex-col border-l border-white/75 relative z-10 shrink-0">
      {/* Header + mode selector */}
      <div className="p-4 border-b border-white/50 shrink-0">
        <h3 className="font-label-md font-bold text-on-surface-variant/70 uppercase tracking-tight mb-3">
          Context Builder
        </h3>
        <div className="flex bg-surface-container-low p-1 rounded-lg gap-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                mode === m.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-on-surface-variant hover:bg-white/50'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-7">
        {/* Active File */}
        <section>
          <h4 className="text-[10px] font-bold text-on-surface-variant uppercase mb-2 tracking-wide">Active File</h4>
          {activeFile ? (
            <div className="glass-card rounded-xl p-3 border-primary/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="material-symbols-outlined text-blue-500 text-[18px] shrink-0">
                    {fileIcon(activeFile.filePath)}
                  </span>
                  <span className="text-[11px] font-bold truncate">{shortName(activeFile.filePath)}</span>
                </div>
                <span className="text-[9px] text-green-600 font-medium shrink-0">
                  {relativeTime(activeFile.lastModified)}
                </span>
              </div>
              <div className="bg-surface-container rounded-lg p-2 font-mono text-[8px] leading-relaxed text-on-surface-variant/60 h-12 overflow-hidden">
                {activeFile.content.slice(0, 120) || '// empty file'}
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-xl p-3 text-center">
              <p className="text-[10px] text-on-surface-variant/60 leading-tight">
                No active file. Open a file in VS Code to anchor Smart Auto context.
              </p>
            </div>
          )}
        </section>

        {/* Imported Files */}
        {importedFiles.length > 0 && (
          <section>
            <h4 className="text-[10px] font-bold text-on-surface-variant uppercase mb-2 tracking-wide">Imported Files</h4>
            <div className="flex flex-col gap-1.5">
              {importedFiles.map((f) => (
                <button
                  key={f.id}
                  onClick={() => toggleFile(f.id)}
                  className="flex items-center gap-2 text-[11px] hover:bg-white/30 rounded-md px-1 py-0.5 transition-colors text-left"
                >
                  <Checkbox checked={checkedFileIds.includes(f.id)} />
                  <span className="truncate">{shortName(f.filePath)}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Recently Changed */}
        {recentlyChanged.length > 0 && (
          <section>
            <h4 className="text-[10px] font-bold text-on-surface-variant uppercase mb-2 tracking-wide">Recently Changed</h4>
            <div className="flex flex-col gap-1.5">
              {recentlyChanged.slice(0, 8).map((f) => (
                <button
                  key={f.id}
                  onClick={() => toggleFile(f.id)}
                  className="flex items-center justify-between text-[11px] hover:bg-white/30 rounded-md px-1 py-0.5 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Checkbox checked={checkedFileIds.includes(f.id)} />
                    <span className="truncate">{shortName(f.filePath)}</span>
                  </div>
                  <span className="text-[9px] text-on-surface-variant/60 shrink-0">{relativeTime(f.lastModified)}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Knowledge Cards */}
        {cards.length > 0 && (
          <section>
            <h4 className="text-[10px] font-bold text-on-surface-variant uppercase mb-2 tracking-wide">Knowledge Cards</h4>
            <div className="flex flex-col gap-1.5">
              {cards.slice(0, 10).map((c) => (
                <button
                  key={c.id}
                  onClick={() => toggleCard(c.id)}
                  className="flex items-start gap-2 text-[10px] hover:bg-white/30 rounded-md px-1 py-0.5 transition-colors text-left"
                >
                  <Checkbox checked={checkedCardIds.includes(c.id)} />
                  <span className="leading-tight line-clamp-2">{c.content.slice(0, 80)}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Empty state when nothing synced */}
        {projectFiles.length === 0 && cards.length === 0 && (
          <div className="text-center py-6">
            <span className="material-symbols-outlined text-3xl text-on-surface-variant/30">folder_off</span>
            <p className="text-[10px] text-on-surface-variant/50 mt-2 leading-tight">
              No files or knowledge cards yet. Sync a project folder to build context.
            </p>
          </div>
        )}
      </div>

      {/* Footer — token estimate + inject */}
      <div className="p-4 bg-white/40 border-t border-white/50 flex flex-col gap-2 shrink-0">
        <div className="flex justify-between items-end">
          <span className="text-[10px] text-on-surface-variant">
            {calculating ? 'Calculating…' : `Est. tokens: ${tokenEstimate.toLocaleString()}`}
          </span>
          <span className={`text-[10px] font-bold ${calculating ? 'text-on-surface-variant' : pctColor}`}>
            {calculating ? '…' : `${rawPct}%`}
          </span>
        </div>
        <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all duration-300 ${calculating ? 'opacity-50' : ''}`}
            style={{ width: `${barPct}%` }}
          />
        </div>
        {!calculating && rawPct >= 80 && (
          <p className={`text-[9px] font-medium ${pctColor} leading-tight`}>
            {rawPct >= 100
              ? mode === 'full'
                ? `Full project ≈ ${tokenEstimate.toLocaleString()} tokens — too large for ${PROVIDER_CONFIG[activeModel].label} (${rawPct}%). Try Smart or Selected mode.`
                : `Exceeds ${PROVIDER_CONFIG[activeModel].label}'s window (${rawPct}%) — narrow your selection.`
              : `Approaching ${PROVIDER_CONFIG[activeModel].label}'s context limit`}
          </p>
        )}
        <button
          onClick={onInject}
          className="w-full py-3 bg-gradient-to-r from-primary to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-transform mt-1"
        >
          Inject context
        </button>
        <p className="text-[9px] text-on-surface-variant/70 text-center leading-tight">
          Adds selected context to your message before sending
        </p>
      </div>
    </aside>
  )
}
