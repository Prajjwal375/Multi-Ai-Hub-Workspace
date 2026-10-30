import React from 'react'

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function GlassCard({ children, className = '', ...props }: GlassCardProps) {
  return (
    <div className={`glass-card rounded-2xl border border-white/20 p-6 ${className}`} {...props}>
      {children}
    </div>
  )
}
