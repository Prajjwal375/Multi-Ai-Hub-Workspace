import React from 'react'
import { PROVIDER_CONFIG, type ProviderModel } from '../types'

interface Props {
  open: boolean
  targetModel: ProviderModel
  contextBlock: string
  tokenEstimate: number
  onConfirm: () => void
  onCancel: () => void
}

export function SwitchContextModal({
  open,
  targetModel,
  contextBlock,
  tokenEstimate,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null

  const cfg = PROVIDER_CONFIG[targetModel]
  const limit = cfg.contextWindow
  const pct = Math.min(100, Math.round((tokenEstimate / limit) * 100))
  const over = pct >= 100
  const warn = pct >= 80
  const pctColor = over ? 'text-error' : warn ? 'text-amber-600' : 'text-primary'
  const barColor = over ? 'bg-error' : warn ? 'bg-amber-500' : 'bg-primary'

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="glass-card rounded-2xl p-6 w-[640px] max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cfg.color }} />
            <h3 className="font-headline-md !text-[18px] font-bold text-on-surface">
              Inject context into {cfg.label}
            </h3>
          </div>
          <button onClick={onCancel} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Token meter */}
        <div className="mb-3">
          <div className="flex justify-between items-end mb-1">
            <span className="text-label-sm text-on-surface-variant">
              {tokenEstimate.toLocaleString()} tokens · {cfg.label} limit {limit.toLocaleString()}
            </span>
            <span className={`text-label-sm font-bold ${pctColor}`}>{pct}%</span>
          </div>
          <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
            <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
          </div>
          {warn && (
            <p className={`text-[11px] mt-1.5 font-medium ${pctColor}`}>
              {over
                ? `This exceeds ${cfg.label}'s context window. Consider narrowing your selection.`
                : `You're over 80% of ${cfg.label}'s context window.`}
            </p>
          )}
        </div>

        {/* Preview */}
        <div className="flex-1 min-h-0 overflow-auto bg-white/40 border border-white/50 rounded-xl p-3 mb-4">
          <pre className="text-[11px] leading-relaxed text-on-surface whitespace-pre-wrap break-words font-mono">
            {contextBlock || '(empty — select files or knowledge cards on the right)'}
          </pre>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 bg-white/40 border border-white/60 rounded-xl font-label-md text-on-surface hover:bg-white/60 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={over}
            className="px-5 py-2.5 bg-primary text-white rounded-xl font-label-md font-semibold hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title={over ? 'Context exceeds the provider context window' : undefined}
          >
            <span className="material-symbols-outlined text-[18px]">{over ? 'block' : 'input'}</span>
            {over ? 'Too large to inject' : `Inject into ${cfg.label}`}
          </button>
        </div>
      </div>
    </div>
  )
}
