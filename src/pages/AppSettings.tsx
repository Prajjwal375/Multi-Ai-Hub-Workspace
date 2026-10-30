import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUiStore } from '../store/uiStore'
import { useProjectStore } from '../store/projectStore'

const APP_VERSION = '1.0.0'

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
        checked ? 'bg-primary' : 'bg-primary/10'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function Section({ icon, title, action, children }: {
  icon: string
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="glass-card p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">{icon}</span>
          <h2 className="font-headline-md !text-[20px] text-on-surface">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function AppSettings() {
  const navigate = useNavigate()
  const activeProject = useProjectStore((s) => s.activeProject)
  const wsConnected = useUiStore((s) => s.wsConnected)
  const { addToast } = useUiStore()

  const [darkMode, setDarkMode] = useState(false)
  const [autoSync, setAutoSync] = useState(true)
  const [defaultMode, setDefaultMode] = useState('smart')
  const [autoIncludeActive, setAutoIncludeActive] = useState(true)
  const [maxTokens, setMaxTokens] = useState('8000')

  useEffect(() => {
    window.api.settings.getApp().then((s) => {
      setDarkMode(s.theme === 'dark')
    }).catch(() => {})
  }, [])

  const handleTheme = async (dark: boolean) => {
    setDarkMode(dark)
    document.documentElement.classList.toggle('dark', dark)
    try {
      await window.api.settings.setApp('theme', dark ? 'dark' : 'light')
    } catch {
      addToast({ type: 'error', title: 'Failed to save theme' })
    }
  }

  const persist = async (key: string, value: string) => {
    try {
      await window.api.settings.setApp(key, value)
    } catch {
      addToast({ type: 'error', title: 'Failed to save setting' })
    }
  }

  return (
    <div className="w-full h-full overflow-y-auto">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-6">
        {!activeProject && (
          <button
            onClick={() => navigate('/')}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/40 transition-colors text-on-surface"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        )}
        <span className="font-headline-md text-primary font-bold text-[20px]">SaKAi Hub</span>
      </header>

      <main className="px-6 pb-20 flex flex-col items-center">
        <div className="w-full max-w-[680px]">
          {/* Page header */}
          <div className="mb-10">
            <h1 className="font-headline-lg text-on-surface mb-1">App Settings</h1>
            <p className="font-body-lg text-on-surface-variant">Global application preferences</p>
          </div>

          <div className="flex flex-col gap-6">
            {/* Appearance */}
            <Section icon="palette" title="Appearance">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-label-md text-on-surface">Dark mode</p>
                  <p className="text-label-sm text-on-surface-variant">Switch between light and dark themes</p>
                </div>
                <Toggle checked={darkMode} onChange={handleTheme} />
              </div>
            </Section>

            {/* VS Code Extension */}
            <Section
              icon="terminal"
              title="VS Code Extension"
              action={
                <span
                  className={`px-3 py-1 rounded-full text-label-sm font-bold flex items-center gap-1.5 backdrop-blur-sm ${
                    wsConnected ? 'bg-green-100/50 text-green-700' : 'bg-red-100/50 text-red-700'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  {wsConnected ? 'Connected' : 'Disconnected'}
                </span>
              }
            >
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-label-sm text-on-surface-variant">Connection Port</label>
                  <input
                    type="text"
                    value="54321"
                    readOnly
                    className="bg-white/20 border border-white/40 rounded-xl px-4 py-2.5 font-mono text-body-md text-on-surface-variant cursor-not-allowed"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-label-md text-on-surface">Auto-sync</p>
                    <p className="text-label-sm text-on-surface-variant">Keep workspace files updated in real-time</p>
                  </div>
                  <Toggle checked={autoSync} onChange={(v) => { setAutoSync(v); persist('autoSync', String(v)) }} />
                </div>
              </div>
            </Section>

            {/* Context Builder Defaults */}
            <Section icon="architecture" title="Context Builder Defaults">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-label-sm text-on-surface-variant">Default Mode</label>
                  <div className="relative">
                    <select
                      value={defaultMode}
                      onChange={(e) => { setDefaultMode(e.target.value); persist('defaultContextMode', e.target.value) }}
                      className="w-full bg-white/20 border border-white/40 rounded-xl px-4 py-2.5 text-body-md text-on-surface focus:ring-2 focus:ring-primary/20 outline-none appearance-none cursor-pointer"
                    >
                      <option value="smart">Smart Auto</option>
                      <option value="selected">Selected Files</option>
                      <option value="full">Full Project</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                      expand_more
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-label-md text-on-surface">Auto-include active file</p>
                    <p className="text-label-sm text-on-surface-variant">Automatically add the current file to context</p>
                  </div>
                  <Toggle checked={autoIncludeActive} onChange={(v) => { setAutoIncludeActive(v); persist('autoIncludeActiveFile', String(v)) }} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-label-sm text-on-surface-variant">Max context tokens</label>
                  <input
                    type="text"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(e.target.value.replace(/[^\d]/g, ''))}
                    onBlur={() => persist('maxAutoContextTokens', maxTokens)}
                    className="bg-white/20 border border-white/40 rounded-xl px-4 py-2.5 font-mono text-body-md text-on-surface focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
              </div>
            </Section>

            {/* About */}
            <Section icon="info" title="About">
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <p className="font-label-md text-on-surface">App Version</p>
                  <p className="text-body-md text-on-surface-variant">{APP_VERSION}</p>
                </div>
                <div className="h-px bg-white/20" />
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1 text-on-surface">
                      <p className="font-label-md">Install VS Code Extension</p>
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                    </div>
                    <p className="text-label-sm text-on-surface-variant">Step-by-step setup guide</p>
                  </div>
                  <button
                    onClick={() => addToast({ type: 'info', title: 'Setup guide', message: 'Search "SaKAi Hub" in the VS Code Extensions marketplace.' })}
                    className="text-primary hover:underline text-label-md font-medium"
                  >
                    Open Guide
                  </button>
                </div>
              </div>
            </Section>
          </div>
        </div>
      </main>
    </div>
  )
}
