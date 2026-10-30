import React from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { useUiStore } from '../store/uiStore'
import { useProjectStore } from '../store/projectStore'

export function Sidebar() {
  const { id: routeId } = useParams()
  const activeProject = useProjectStore((s) => s.activeProject)
  const id = routeId || activeProject?.id || ''
  const navigate = useNavigate()
  const expanded = useUiStore((s) => s.sidebarExpanded)
  const setExpanded = useUiStore((s) => s.setSidebarExpanded)

  const navItems = [
    { icon: 'grid_view',   label: 'Dashboard',        path: `/project/${id}/dashboard` },
    { icon: 'chat_bubble', label: 'Chat',              path: `/project/${id}/chat` },
    { icon: 'psychology',  label: 'Knowledge Base',    path: `/project/${id}/knowledge` },
    { icon: 'folder',      label: 'Project Settings',  path: `/project/${id}/settings` },
  ]

  return (
    <aside
      id="sidebar"
      className={`
        fixed left-0 top-0 h-full flex flex-col py-4 justify-between z-50
        bg-white/35 backdrop-blur-xl border-r border-white/75
        transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${expanded ? 'w-[220px]' : 'w-[56px]'}
      `}
    >
      {/* Top section */}
      <div className="flex flex-col w-full gap-6 px-2">
        {/* Logo + toggle */}
        <div className="flex items-center gap-2 pl-1.5 h-10">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-primary hover:bg-white/20 w-8 h-8 flex items-center justify-center rounded-full transition-all shrink-0"
            aria-label="Toggle sidebar"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <span
            className={`font-bold text-[18px] text-primary whitespace-nowrap overflow-hidden transition-all duration-300 ${expanded ? 'opacity-100 max-w-[160px]' : 'opacity-0 max-w-0'}`}
          >
            SaKAi Hub
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 w-full">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              title={!expanded ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-2 py-2.5 rounded-xl transition-all duration-200 active:scale-95 group relative
                ${isActive
                  ? 'bg-primary/10 text-primary border-l-2 border-primary pl-[6px]'
                  : 'text-slate-500 hover:bg-white/40 hover:text-slate-700'
                }`
              }
            >
              <span
                className="material-symbols-outlined shrink-0 ml-1 text-[22px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {item.icon}
              </span>
              <span
                className={`font-label-md font-semibold whitespace-nowrap overflow-hidden transition-all duration-300 ${expanded ? 'opacity-100 max-w-[160px]' : 'opacity-0 max-w-0'}`}
              >
                {item.label}
              </span>
              {/* Tooltip when collapsed */}
              {!expanded && (
                <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-[11px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
                  {item.label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Bottom section */}
      <div className="flex flex-col w-full px-2">
        <div className={`h-px bg-white/40 my-2 mx-auto transition-all duration-300 ${expanded ? 'w-[190px]' : 'w-[40px]'}`} />

        {/* Switch Project */}
        <button
          onClick={() => {
            // Hide any embedded webview, clear active project (resets per-project stores)
            window.api.webview.hideAll().catch(() => {})
            useProjectStore.getState().setActiveProject(null)
            navigate('/')
          }}
          title={!expanded ? 'Switch Project' : undefined}
          className="flex items-center gap-3 px-2 py-2.5 rounded-xl transition-all duration-200 active:scale-95 text-slate-500 hover:bg-white/40 hover:text-slate-700 group relative w-full"
        >
          <span className="material-symbols-outlined shrink-0 ml-1 text-[22px]">swap_horiz</span>
          <span className={`font-label-md font-semibold whitespace-nowrap overflow-hidden transition-all duration-300 ${expanded ? 'opacity-100 max-w-[160px]' : 'opacity-0 max-w-0'}`}>
            Switch Project
          </span>
          {!expanded && (
            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-[11px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
              Switch Project
            </span>
          )}
        </button>

        {/* App Settings */}
        <NavLink
          to="/settings"
          title={!expanded ? 'App Settings' : undefined}
          className={({ isActive }) =>
            `flex items-center gap-3 px-2 py-2.5 rounded-xl transition-all duration-200 active:scale-95 group relative
            ${isActive
              ? 'bg-primary/10 text-primary border-l-2 border-primary pl-[6px]'
              : 'text-slate-500 hover:bg-white/40 hover:text-slate-700'
            }`
          }
        >
          <span
            className="material-symbols-outlined shrink-0 ml-1 text-[22px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            settings
          </span>
          <span className={`font-label-md font-semibold whitespace-nowrap overflow-hidden transition-all duration-300 ${expanded ? 'opacity-100 max-w-[160px]' : 'opacity-0 max-w-0'}`}>
            App Settings
          </span>
          {!expanded && (
            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-[11px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
              App Settings
            </span>
          )}
        </NavLink>
      </div>
    </aside>
  )
}
