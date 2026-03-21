'use client'

interface ProgressBarProps {
  value: number
  animated?: boolean
}

export default function ProgressBar({ value, animated = false }: ProgressBarProps) {
  return (
    <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
      <div
        className={`h-full rounded-full transition-[width] duration-300 ease-out ${
          animated
            ? 'shimmer'
            : 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-glow)]'
        }`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
