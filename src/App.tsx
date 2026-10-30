import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProjectSelector } from './pages/ProjectSelector'
import { Dashboard } from './pages/Dashboard'
import { Chat } from './pages/Chat'
import { KnowledgeBase } from './pages/KnowledgeBase'
import { ProjectSettings } from './pages/ProjectSettings'
import { AppSettings } from './pages/AppSettings'
import { Sidebar } from './components/Sidebar'
import { ToastContainer } from './components/ToastContainer'
import { SnowEffect } from './components/SnowEffect'
import { useProjectStore } from './store/projectStore'
import { useAccountStore } from './store/accountStore'
import { useUiStore } from './store/uiStore'

/** Runs once on launch: loads global data, subscribes to WS status, applies theme. */
function useBootstrap() {
  const loadProjects = useProjectStore((s) => s.loadProjects)
  const loadAccounts = useAccountStore((s) => s.loadAccounts)
  const setWsConnected = useUiStore((s) => s.setWsConnected)

  useEffect(() => {
    loadProjects()
    loadAccounts()

    // Live VS Code connection status (drives the Connected/Disconnected badges)
    const unsub = window.api.ws.onStatus((status) => {
      setWsConnected(status.connected)
    })

    // Apply persisted theme on launch
    window.api.settings
      .getApp()
      .then((s) => {
        document.documentElement.classList.toggle('dark', s.theme === 'dark')
      })
      .catch(() => {})

    return unsub
  }, [])
}

function ProjectLayout({ children }: { children: React.ReactNode }) {
  const activeProject = useProjectStore((s) => s.activeProject)
  const expanded = useUiStore((s) => s.sidebarExpanded)

  if (!activeProject) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex w-full h-full">
      <Sidebar />
      {/* Offset for fixed sidebar */}
      <main
        className="flex-1 overflow-hidden relative transition-all duration-300"
        style={{ marginLeft: expanded ? '220px' : '56px' }}
      >
        {children}
      </main>
    </div>
  )
}

function SettingsRoute() {
  const activeProject = useProjectStore((s) => s.activeProject)
  const expanded = useUiStore((s) => s.sidebarExpanded)

  // When a project is open, keep the sidebar visible; otherwise show standalone
  if (activeProject) {
    return (
      <div className="flex w-full h-full">
        <Sidebar />
        <main
          className="flex-1 overflow-hidden relative transition-all duration-300"
          style={{ marginLeft: expanded ? '220px' : '56px' }}
        >
          <AppSettings />
        </main>
      </div>
    )
  }
  return <AppSettings />
}

function App() {
  useBootstrap()
  return (
    <>
    <SnowEffect />
    <Routes>
      <Route path="/" element={<ProjectSelector />} />
      <Route path="/settings" element={<SettingsRoute />} />

      {/* Project Routes */}
      <Route
        path="/project/:id/*"
        element={
          <ProjectLayout>
            <Routes>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="chat" element={<Chat />} />
              <Route path="knowledge" element={<KnowledgeBase />} />
              <Route path="settings" element={<ProjectSettings />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Routes>
          </ProjectLayout>
        }
      />
    </Routes>
    <ToastContainer />
    </>
  )
}

export default App
