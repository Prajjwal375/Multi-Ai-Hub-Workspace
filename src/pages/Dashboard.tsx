import React, { useEffect, useState } from 'react'
import { useAccountStore } from '../store/accountStore'
import { useProjectStore } from '../store/projectStore'
import { useUiStore } from '../store/uiStore'
import { GlassCard } from '../components/GlassCard'
import type { AiAccount, ProviderModel } from '../types'

// ── Provider metadata ─────────────────────────────────────────────────────────
const PROVIDERS: {
  model: ProviderModel
  label: string
  iconBg: string
  iconUrl: string
  emptyMsg: string
  connectLabel: string
}[] = [
  {
    model: 'claude',
    label: 'Claude',
    iconBg: 'bg-orange-100',
    iconUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCgZw8kSd5vC51O652x-iVMC_Cj6K93GdskWyYE6WNkqSnHuRgUiXJUvLL6tZB-6IZKRGVJjQg9yZGQScPx4gkmrjPJC5IhCb8dmjl1SqSrvpQToBKgqJeGa9_UnwDcd6kxsyt2cyGQl3Oyhc0Fg1a1TysAAIoD-MOMkrhr8QtzQnz65Ea1zFmfldtswl0X7yWxZZODF-srw7YSX3DpC-yFiZzHLo-jl9maDg-yp_KsvGuJbkgV7MKbiPw3h2ywobci_VqRiYLGGLz-',
    emptyMsg: 'Connect your Anthropic account to access Claude.',
    connectLabel: 'Connect Claude Account',
  },
  {
    model: 'chatgpt',
    label: 'ChatGPT',
    iconBg: 'bg-green-100',
    iconUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBoNE-BwuHrRwchuxLjWgs-2FGbYCVJZ9RgZ8MUhlt1o9SSLpw-pHxyF6j8hQfdK-sIottBztctuxGqFHPC-P2UA2evpPFAccrsOJfcoED04XTsyaKRKqvGfZcJyX805Y1q_2kRUdzWccSweeSO3F_vQxjz63Wz3-DGCPV94iRW0KoSEZGhYfaTs4HOqFdqTmaAxT8RbGfgwlqcC8faLeMF2HCgl59Iq5oCY9__aw_okbjC86tNwPHa4cBQ--03gooYT-ivcdrEDOgl',
    emptyMsg: 'Connect your OpenAI account to access ChatGPT.',
    connectLabel: 'Connect ChatGPT Account',
  },
  {
    model: 'gemini',
    label: 'Gemini',
    iconBg: 'bg-purple-100',
    iconUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDWe-EbTW4LeWiT1Emf1d-lCIw98BsDeZyh28KVk2A9zvWcjpJMRNVqyz8KWbJbRWLucY_kyYV2PFUbjWONW8k84ZzBkrNF52ht5kdMWDG7hMzShklhbsXi3A_ShJ6o1Js70U0iikjQQS9ItNigwW0okIq-dUuiLbgkXDCnMCXun335z5F9P3yEZLU6MpzQtDSsBZsXxKQklC3-CGZxa_DuvlaXoAbvB4KW8pHbJFZn1xdlQX1pehPFfC7DYLVTIobR7_I_wXGsftGG',
    emptyMsg: 'Connect your Google account to access Gemini.',
    connectLabel: 'Connect Google Account',
  },
  {
    model: 'grok',
    label: 'Grok',
    iconBg: 'bg-gray-900',
    iconUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuALBNqH9sgZhlNZwVD6R7OG5PEzqzAo-CVs7MjUugfipJvV4NtJF9QejjrJXzXmseMn9bsPGG6JAv_hOhFU1vamty7onuJCxKYbAlZSIwnhqu2Z6qmsItP9vr9BaX3jaXINAHnBEBiGcms8h2t75qN2i8DuKXkgU3h_FwPivs-zEQZDyfHt790xMe7moqwTXos_qrCLtLg-jsSDwSBHB0lVbLj755SbKPhBC2ifitVFytDhebYasiTHNY4oe8MKHF7a6Bak0_J01Q5G',
    emptyMsg: 'Connect your X account to access Grok via SaKAi Hub.',
    connectLabel: 'Connect X Account',
  },
]

// ── Add Account Modal ─────────────────────────────────────────────────────────
function AddAccountModal({
  model,
  label,
  onClose,
}: {
  model: ProviderModel
  label: string
  onClose: () => void
}) {
  const { addAccount } = useAccountStore()
  const { addToast } = useUiStore()
  const [accountLabel, setAccountLabel] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountLabel.trim()) return
    setLoading(true)
    try {
      const account = await addAccount({ model, label: accountLabel.trim() })
      addToast({ type: 'success', title: `${label} account added`, message: 'Opening sign-in window…' })
      // Open the real provider login in this account's isolated session
      await window.api.webview.login(account.id, model)
      onClose()
    } catch (err: any) {
      const msg = String(err?.message || err)
      if (msg.includes('UNIQUE') || msg.includes('DUPLICATE')) {
        addToast({ type: 'error', title: 'Account already exists', message: 'A session with this label already exists.' })
      } else {
        addToast({ type: 'error', title: 'Failed to add account', message: msg })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass-card p-6 w-[400px] shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-headline-md !text-[18px] font-bold text-on-surface">
            Connect {label} Account
          </h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <p className="text-label-md text-on-surface-variant mb-4">
          Enter a label to identify this account. A secure browser window will open so you can sign in
          with your Google/Gmail account — each account stays in its own isolated session.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-label-sm text-on-surface-variant block mb-1">Account Label</label>
            <input
              type="text"
              value={accountLabel}
              onChange={(e) => setAccountLabel(e.target.value)}
              placeholder={`e.g. Personal, Work`}
              maxLength={50}
              autoFocus
              className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-2.5 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={!accountLabel.trim() || loading}
              className="flex-1 bg-primary text-white py-2.5 rounded-xl font-label-md font-semibold hover:brightness-110 transition-all disabled:opacity-50"
            >
              {loading ? 'Adding…' : 'Add Account'}
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

// ── Provider Card ─────────────────────────────────────────────────────────────
function ProviderCard({
  model,
  label,
  iconBg,
  iconUrl,
  emptyMsg,
  connectLabel,
  accounts,
  onAddAccount,
  onSetActive,
  onRemove,
  onLogin,
}: {
  model: ProviderModel
  label: string
  iconBg: string
  iconUrl: string
  emptyMsg: string
  connectLabel: string
  accounts: AiAccount[]
  onAddAccount: (model: ProviderModel) => void
  onSetActive: (id: string) => void
  onRemove: (id: string) => void
  onLogin: (id: string, model: ProviderModel) => void
}) {
  const isEmpty = accounts.length === 0
  const count = accounts.length

  return (
    <GlassCard className={`p-6 flex flex-col gap-4 ${isEmpty ? 'justify-between' : ''}`}>
      {/* Card header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center`}>
            <img alt={label} className="w-8 h-8 rounded-sm object-contain" src={iconUrl} />
          </div>
          <div>
            <h3 className="font-headline-md !text-[20px] font-semibold text-on-surface">{label}</h3>
            <p className={`text-label-sm ${isEmpty ? 'text-error' : 'text-on-surface-variant opacity-70'}`}>
              {isEmpty ? 'Not connected' : `${count} connected account${count > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        {!isEmpty && (
          <button className="text-on-surface-variant hover:text-primary transition-colors p-1 rounded-lg hover:bg-white/20" title={`${count} account${count > 1 ? 's' : ''} connected`}>
            <span className="material-symbols-outlined">{count > 1 ? 'group' : 'person'}</span>
          </button>
        )}
      </div>

      {/* Account list or empty state */}
      {isEmpty ? (
        <div className="py-2 text-center space-y-4">
          <p className="text-body-md text-on-surface opacity-80">{emptyMsg}</p>
          <button
            onClick={() => onAddAccount(model)}
            className="w-full bg-primary text-white py-3 rounded-xl font-label-md font-bold hover:brightness-110 transition-all shadow-lg shadow-primary/20"
          >
            {connectLabel}
          </button>
        </div>
      ) : (
        <div className="space-y-2 mt-1">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className={`p-3 rounded-lg flex items-center justify-between group ${
                acc.isActive
                  ? 'bg-primary/10 border-l-2 border-primary'
                  : 'bg-white/10 border border-white/20'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${acc.isActive ? 'bg-green-500' : 'bg-slate-400'}`} />
                <span className={`font-label-md truncate ${acc.isActive ? 'text-on-surface' : 'text-on-surface opacity-70'}`}>
                  {acc.label}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] uppercase font-bold tracking-wider ${acc.isActive ? 'text-primary' : 'opacity-60'}`}>
                  {acc.isActive ? 'Active' : 'Standby'}
                </span>
                {/* Actions on hover */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                  <button
                    onClick={() => onLogin(acc.id, model)}
                    className="text-on-surface-variant hover:text-primary transition-colors"
                    title="Sign in / re-authenticate"
                  >
                    <span className="material-symbols-outlined !text-[16px]">login</span>
                  </button>
                  {!acc.isActive && (
                    <button
                      onClick={() => onSetActive(acc.id)}
                      className="text-[11px] text-primary hover:underline px-1"
                      title="Set as active"
                    >
                      Use
                    </button>
                  )}
                  <button
                    onClick={() => onRemove(acc.id)}
                    className="text-error hover:text-error/80 transition-colors"
                    title="Remove account"
                  >
                    <span className="material-symbols-outlined !text-[16px]">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Connect new account button */}
          <button
            onClick={() => onAddAccount(model)}
            className="w-full border-2 border-dashed border-primary/20 hover:border-primary/40 p-3 rounded-lg flex items-center justify-center gap-2 text-primary/60 hover:text-primary transition-all"
          >
            <span className="material-symbols-outlined !text-[18px]">add</span>
            <span className="font-label-md">Connect new account</span>
          </button>
        </div>
      )}
    </GlassCard>
  )
}

// ── Dashboard Page ────────────────────────────────────────────────────────────
export function Dashboard() {
  const { loadAccounts, setActive, removeAccount, getByModel } = useAccountStore()
  const { activeProject } = useProjectStore()
  const wsConnected = useUiStore((s) => s.wsConnected)
  const { addToast } = useUiStore()
  const [addingFor, setAddingFor] = useState<ProviderModel | null>(null)

  const [stats, setStats] = useState({ files: 0, cards: 0, chats: 0, lastSync: null as string | null })

  useEffect(() => {
    loadAccounts()
  }, [])

  const loadStats = async () => {
    if (!activeProject) return
    try {
      const [files, cards, chats] = await Promise.all([
        window.api.files.list(activeProject.id),
        window.api.knowledge.list(activeProject.id),
        window.api.chats.list(activeProject.id),
      ])
      const lastSync = files.reduce(
        (latest, f) => (f.lastModified > (latest ?? '') ? f.lastModified : latest),
        null as string | null
      )
      setStats({ files: files.length, cards: cards.length, chats: chats.length, lastSync })
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadStats()
    if (!activeProject) return
    const unsub = window.api.files.onChanged(loadStats)
    return unsub
  }, [activeProject?.id])

  const handleSetActive = async (id: string) => {
    try {
      await setActive(id)
      addToast({ type: 'success', title: 'Active account updated' })
    } catch {
      addToast({ type: 'error', title: 'Failed to update active account' })
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await removeAccount(id)
      addToast({ type: 'info', title: 'Account removed' })
    } catch {
      addToast({ type: 'error', title: 'Failed to remove account' })
    }
  }

  const handleLogin = (id: string, model: ProviderModel) => {
    window.api.webview.login(id, model).catch(() => {
      addToast({ type: 'error', title: 'Could not open sign-in window' })
    })
  }

  const formatSync = (iso: string | null) => {
    if (!iso) return 'Never'
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins} min ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return new Date(iso).toLocaleDateString()
  }

  return (
    <>
      <div className="h-full overflow-y-auto">
        <div className="px-8 pb-12 flex flex-col">
          {/* Header */}
          <header className="flex items-center justify-between py-6">
            <div>
              <h1 className="font-headline-md text-headline-md font-bold leading-tight text-on-surface">Dashboard</h1>
              <p className="font-label-md text-label-md text-on-surface-variant opacity-80 mt-0.5">
                {activeProject ? `Workspace · ${activeProject.name}` : 'Manage your AI accounts'}
              </p>
            </div>
            <button
              onClick={() => setAddingFor('claude')}
              className="bg-primary text-white px-6 py-2.5 rounded-lg font-label-md flex items-center gap-2 hover:brightness-110 transition-all shadow-sm border-t border-white/20"
            >
              <span className="material-symbols-outlined !text-[20px]">add</span>
              Add account
            </button>
          </header>

          {/* Workspace status strip */}
          {activeProject && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 max-w-[1440px]">
              <StatTile
                icon="folder_open"
                label="Files indexed"
                value={String(stats.files)}
                tone={stats.files > 0 ? 'ok' : 'idle'}
              />
              <StatTile icon="schedule" label="Last sync" value={formatSync(stats.lastSync)} tone="idle" />
              <StatTile
                icon={wsConnected ? 'cable' : 'power_off'}
                label="VS Code"
                value={wsConnected ? 'Connected' : 'Disconnected'}
                tone={wsConnected ? 'ok' : 'warn'}
              />
              <StatTile icon="psychology" label="Knowledge cards" value={String(stats.cards)} tone="idle" />
            </div>
          )}

          {/* 2×2 Provider Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[1440px]">
            {PROVIDERS.map((p) => (
              <ProviderCard
                key={p.model}
                {...p}
                accounts={getByModel(p.model)}
                onAddAccount={setAddingFor}
                onSetActive={handleSetActive}
                onRemove={handleRemove}
                onLogin={handleLogin}
              />
            ))}
          </div>

          {/* Folder path footer */}
          {activeProject && (
            <div className="mt-8 max-w-[1440px]">
              <GlassCard className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined">drive_folder_upload</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-label-md font-semibold text-on-surface">Connected folder</p>
                  <p className="font-mono text-xs text-on-surface-variant truncate">{activeProject.folderPath}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-amber-500'}`} />
                  <span className="text-label-sm text-on-surface-variant">{wsConnected ? 'Live' : 'Idle'}</span>
                </div>
              </GlassCard>
            </div>
          )}
        </div>
      </div>

      {/* Add Account Modal */}
      {addingFor && (
        <AddAccountModal
          model={addingFor}
          label={PROVIDERS.find((p) => p.model === addingFor)?.label ?? addingFor}
          onClose={() => setAddingFor(null)}
        />
      )}
    </>
  )
}

function StatTile({
  icon, label, value, tone,
}: {
  icon: string
  label: string
  value: string
  tone: 'ok' | 'warn' | 'idle'
}) {
  const color = tone === 'ok' ? 'text-green-600' : tone === 'warn' ? 'text-amber-600' : 'text-primary'
  return (
    <GlassCard className="!p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 ${color}`}>
        <span className="material-symbols-outlined !text-[20px]">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-label-sm text-on-surface-variant truncate">{label}</p>
        <p className="font-label-md font-bold text-on-surface truncate">{value}</p>
      </div>
    </GlassCard>
  )
}
