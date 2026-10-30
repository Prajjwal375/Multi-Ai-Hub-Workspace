import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useProjectStore } from '../store/projectStore'
import { useAccountStore } from '../store/accountStore'
import { useKnowledgeStore } from '../store/knowledgeStore'
import { useContextStore } from '../store/contextStore'
import { useUiStore } from '../store/uiStore'
import { ContextPanel } from '../components/ContextPanel'
import { SwitchContextModal } from '../components/SwitchContextModal'
import { PROVIDER_CONFIG, type ProviderModel, type Chat as ChatType, type ProjectFile } from '../types'

const DOT_COLOR: Record<ProviderModel, string> = {
  claude: 'bg-orange-500',
  chatgpt: 'bg-green-500',
  gemini: 'bg-blue-500',
  grok: 'bg-black',
}

const PROVIDERS: ProviderModel[] = ['claude', 'chatgpt', 'gemini', 'grok']

export function Chat() {
  const { activeProject } = useProjectStore()
  const { getActiveForModel } = useAccountStore()
  const { cards, loadCards } = useKnowledgeStore()
  const { mode, checkedFileIds, checkedCardIds } = useContextStore()
  const { addToast, sidebarExpanded } = useUiStore()

  const [activeModel, setActiveModel] = useState<ProviderModel>('claude')
  const [chats, setChats] = useState<ChatType[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([])

  // Context preview modal state
  const [preview, setPreview] = useState<{ open: boolean; block: string; tokens: number }>({
    open: false,
    block: '',
    tokens: 0,
  })

  const mountRef = useRef<HTMLDivElement>(null)
  const activeAccount = getActiveForModel(activeModel)
  const cfg = PROVIDER_CONFIG[activeModel]

  // ── Data loading ────────────────────────────────────────────────
  useEffect(() => {
    if (!activeProject) return
    loadChats()
    loadFiles()
    loadCards(activeProject.id)
    const unsub = window.api.files.onChanged(loadFiles)
    return unsub
  }, [activeProject?.id])

  const loadChats = async () => {
    if (!activeProject) return
    try { setChats(await window.api.chats.list(activeProject.id)) } catch {}
  }
  const loadFiles = async () => {
    if (!activeProject) return
    try { setProjectFiles(await window.api.files.list(activeProject.id)) } catch {}
  }

  // ── Native webview positioning ──────────────────────────────────
  const computeBounds = useCallback(() => {
    const el = mountRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    return {
      x: Math.round(r.left),
      y: Math.round(r.top),
      width: Math.round(r.width),
      height: Math.round(r.height),
    }
  }, [])

  // Show/hide the webview based on active account + model
  useEffect(() => {
    if (!activeAccount) {
      window.api.webview.hideAll()
      return
    }
    // rAF ensures layout is settled before measuring
    const raf = requestAnimationFrame(() => {
      const bounds = computeBounds()
      if (bounds) window.api.webview.show(activeAccount.id, activeModel, bounds)
    })
    return () => cancelAnimationFrame(raf)
  }, [activeAccount?.id, activeModel, computeBounds])

  // Reposition on sidebar toggle / window resize
  useEffect(() => {
    if (!activeAccount) return
    const update = () => {
      const bounds = computeBounds()
      if (bounds) window.api.webview.setBounds(bounds)
    }
    // Defer so the layout transition (sidebar) has applied
    const t = setTimeout(update, 320)
    window.addEventListener('resize', update)
    const ro = new ResizeObserver(update)
    if (mountRef.current) ro.observe(mountRef.current)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', update)
      ro.disconnect()
    }
  }, [sidebarExpanded, activeAccount?.id, computeBounds])

  // Hide webview when leaving the Chat screen
  useEffect(() => {
    return () => { window.api.webview.hideAll() }
  }, [])

  // Refresh knowledge list when a card is saved from the webview overlay
  useEffect(() => {
    const unsub = window.api.webview.onKnowledgeSaved((card) => {
      addToast({ type: 'success', title: 'Saved to Knowledge', message: card.content.slice(0, 60) })
      if (activeProject) loadCards(activeProject.id)
    })
    return unsub
  }, [activeProject?.id])

  // ── Chat grouping ───────────────────────────────────────────────
  const chatsByModel = useMemo(() => {
    const grouped: Partial<Record<ProviderModel, ChatType[]>> = {}
    for (const p of PROVIDERS) {
      const list = chats.filter((c) => c.model === p)
      if (list.length) grouped[p] = list
    }
    return grouped
  }, [chats])

  const handleNewChat = async () => {
    if (!activeProject) return
    const account = getActiveForModel(activeModel)
    if (!account) {
      addToast({ type: 'warning', title: 'No active account', message: `Connect a ${cfg.label} account in the Dashboard first.` })
      return
    }
    try {
      const chat = await window.api.chats.create({ projectId: activeProject.id, model: activeModel, accountId: account.id })
      setChats((prev) => [chat, ...prev])
      setActiveChatId(chat.id)
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to create chat', message: err?.message })
    }
  }

  // Step 1: assemble context and open the preview modal
  const handleInject = async () => {
    if (!activeProject) return
    const account = getActiveForModel(activeModel)
    if (!account) {
      addToast({ type: 'warning', title: 'No active account for this provider' })
      return
    }
    try {
      const graphRaw = await window.api.files.getImportGraph(activeProject.id)
      const importGraph = new Map<string, string[]>(graphRaw)
      const activeFile = projectFiles.find((f) => f.isActive)
      const ctx = await window.api.context.assemble({
        mode, projectFiles, activeFile, importGraph,
        checkedFileIds, checkedCardIds, knowledgeCards: cards, ignorePatterns: [],
        projectName: activeProject.name,
      })
      if (!ctx.trim()) {
        addToast({ type: 'warning', title: 'Nothing to inject', message: 'Select files or knowledge cards first.' })
        return
      }
      const tokens = await window.api.context.estimateTokens(ctx)
      // Native webview sits above the DOM — hide it so the modal is visible
      await window.api.webview.hideAll()
      setPreview({ open: true, block: ctx, tokens })
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to assemble context', message: err?.message })
    }
  }

  // Step 2: confirm → inject into the provider, then re-show the webview
  const confirmInject = async () => {
    const account = getActiveForModel(activeModel)
    setPreview((p) => ({ ...p, open: false }))
    const bounds = computeBounds()
    if (account && bounds) await window.api.webview.show(account.id, activeModel, bounds)
    if (!account) return
    try {
      const result = await window.api.webview.injectContext(account.id, preview.block)
      if (result.method === 'clipboard') {
        addToast({ type: 'info', title: 'Context copied to clipboard', message: 'Paste it manually into the chat input.' })
      } else {
        addToast({ type: 'success', title: 'Context injected into ' + cfg.label })
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Injection failed', message: err?.message })
    }
  }

  const cancelInject = async () => {
    setPreview((p) => ({ ...p, open: false }))
    const account = getActiveForModel(activeModel)
    const bounds = computeBounds()
    if (account && bounds) await window.api.webview.show(account.id, activeModel, bounds)
  }

  return (
    <div className="flex h-full w-full">
      {/* ── Chat Sidebar ─────────────────────────────────── */}
      <aside className="w-[220px] h-full glass-panel flex flex-col p-4 shrink-0">
        <h2 className="text-on-surface-variant uppercase tracking-wider mb-4 px-1 text-[11px] font-bold">Chats</h2>
        <div className="flex-1 overflow-y-auto flex flex-col gap-5 -mx-1 px-1">
          {Object.keys(chatsByModel).length === 0 ? (
            <div className="text-center pt-8 px-2">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant/30">forum</span>
              <p className="text-[11px] text-on-surface-variant/50 mt-2 leading-tight">No chats yet. Start a new conversation below.</p>
            </div>
          ) : (
            (Object.entries(chatsByModel) as [ProviderModel, ChatType[]][]).map(([model, list]) => (
              <div key={model} className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-1 text-[10px] font-bold text-on-surface-variant/70 uppercase tracking-widest">
                  <span className={`w-1.5 h-1.5 rounded-full ${DOT_COLOR[model]}`} />
                  {PROVIDER_CONFIG[model].label}
                </div>
                <div className="flex flex-col gap-0.5">
                  {list.map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => setActiveChatId(chat.id)}
                      className={`p-2 rounded-lg text-xs cursor-pointer text-left truncate transition-colors ${
                        activeChatId === chat.id ? 'bg-primary/10 text-primary font-medium' : 'text-on-surface-variant hover:bg-white/20'
                      }`}
                    >
                      {chat.title}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        <button
          onClick={handleNewChat}
          className="mt-4 w-full py-3 border border-dashed border-outline-variant/50 rounded-xl text-on-surface-variant text-xs hover:bg-white/20 hover:border-primary/40 hover:text-primary transition-colors shrink-0"
        >
          + New chat
        </button>
      </aside>

      {/* ── Main Workspace ───────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-[64px] shrink-0 flex items-center justify-center px-6 z-10">
          <div className="flex bg-white/40 backdrop-blur-md rounded-full p-1 border border-white/50 shadow-sm">
            {PROVIDERS.map((model) => {
              const isActive = activeModel === model
              return (
                <div key={model} className="relative model-tab group">
                  <button
                    onClick={() => setActiveModel(model)}
                    className={`px-4 py-1.5 rounded-full text-xs flex items-center gap-2 transition-all ${
                      isActive ? 'bg-white text-primary font-bold shadow-sm' : 'text-on-surface-variant font-medium hover:bg-white/50 hover:text-primary'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${DOT_COLOR[model]}`} />
                    {PROVIDER_CONFIG[model].label}
                  </button>
                </div>
              )
            })}
          </div>
        </header>

        {/* Webview canvas */}
        <div className="flex-1 px-6 pb-6 pt-2 flex flex-col overflow-hidden z-10 min-h-0">
          <div className="flex-1 rounded-2xl flex flex-col relative overflow-hidden bg-white/90 backdrop-blur-md border border-outline-variant/30 shadow-[0_8px_30px_rgb(0,0,0,0.12)] w-full max-w-4xl mx-auto min-h-0">
            {/* Browser chrome */}
            <div className="h-10 shrink-0 bg-[#f5f5f5]/80 backdrop-blur border-b border-outline-variant/30 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
              <div className="mx-4 text-xs text-on-surface-variant flex-1 text-center font-medium">{cfg.url.replace('https://', '')}</div>
              {activeAccount && (
                <div className="flex items-center gap-1.5 bg-green-100/80 backdrop-blur px-2 py-0.5 rounded-full border border-green-200/50 shadow-sm">
                  <span className="material-symbols-outlined text-[14px] text-green-600">sync</span>
                  <span className="text-[9px] font-bold text-green-700 uppercase tracking-tight">VS Code Synced</span>
                </div>
              )}
            </div>

            {/* Webview mount target — the native WebContentsView is positioned over this div */}
            {activeAccount ? (
              <div ref={mountRef} className="flex-1 min-h-0 bg-white" />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-transparent text-center p-8">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-3">account_circle_off</span>
                <p className="text-on-surface font-semibold">No active {cfg.label} account</p>
                <p className="text-on-surface-variant text-sm mt-1">Connect an account in the Dashboard to start chatting.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Context Panel ────────────────────────────────────────── */}
      <ContextPanel projectFiles={projectFiles} activeModel={activeModel} onInject={handleInject} />

      {/* Context preview before injection */}
      <SwitchContextModal
        open={preview.open}
        targetModel={activeModel}
        contextBlock={preview.block}
        tokenEstimate={preview.tokens}
        onConfirm={confirmInject}
        onCancel={cancelInject}
      />
    </div>
  )
}
