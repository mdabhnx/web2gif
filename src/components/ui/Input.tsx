'use client'

import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

export default function Input({ error, className = '', ...props }: InputProps) {
  return (
    <div className="w-full">
      <input
        className={`w-full bg-[var(--bg-elevated)] border ${
          error ? 'border-[var(--error)]' : 'border-[var(--border-subtle)]'
        } focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20
        rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
        font-mono text-sm outline-none transition-all duration-300 ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-[var(--error)]">{error}</p>
      )}
    </div>
  )
}
