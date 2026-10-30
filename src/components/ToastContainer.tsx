import React from 'react'
import { useUiStore, type Toast } from '../store/uiStore'

const ICONS: Record<Toast['type'], string> = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
}

const COLORS: Record<Toast['type'], string> = {
  success: 'text-green-600',
  error: 'text-red-500',
  warning: 'text-yellow-600',
  info: 'text-blue-500',
}

export function ToastContainer() {
  const { toasts, removeToast } = useUiStore()
  if (!toasts.length) return null

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end" role="log" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="glass-card flex items-start gap-3 px-4 py-3 min-w-[280px] max-w-[380px] shadow-lg"
        >
          <span className={`material-symbols-outlined text-[20px] shrink-0 mt-0.5 ${COLORS[t.type]}`}>
            {ICONS[t.type]}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-label-md font-semibold text-on-surface">{t.title}</p>
            {t.message && <p className="text-label-sm text-on-surface-variant mt-0.5 break-words">{t.message}</p>}
          </div>
          <button
            onClick={() => removeToast(t.id)}
            className="text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <span className="material-symbols-outlined !text-[18px]">close</span>
          </button>
        </div>
      ))}
    </div>
  )
}
