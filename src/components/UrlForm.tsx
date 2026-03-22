'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

import { type AspectRatio, RATIO_VALUES } from '@/types/job'

export type SpeedOption = 0.5 | 1 | 2
export type FrameCount = 8 | 12 | 20 | 30

const SPEED_LABELS: Record<SpeedOption, string> = {
  0.5: '0.5×',
  1: '1×',
  2: '2×',
}

const FRAME_OPTIONS: FrameCount[] = [8, 12, 20, 30]
const RATIO_OPTIONS: AspectRatio[] = ['16:9', '4:3', '1:1', '9:16', 'full']

interface UrlFormProps {
  onSubmit: (url: string, speed: SpeedOption, frames: FrameCount, ratio: AspectRatio) => void
  disabled: boolean
  loading?: boolean
}

export default function UrlForm({ onSubmit, disabled, loading }: UrlFormProps) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [speed, setSpeed] = useState<SpeedOption>(1)
  const [frames, setFrames] = useState<FrameCount>(12)
  const [ratio, setRatio] = useState<AspectRatio>('16:9')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    let finalUrl = url.trim()
    if (!finalUrl) {
      setError('Please enter a URL')
      return
    }

    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = `https://${finalUrl}`
    }

    try {
      new URL(finalUrl)
    } catch {
      setError('Please enter a valid URL')
      return
    }

    onSubmit(finalUrl, speed, frames, ratio)
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="w-full flex flex-col gap-3"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            error={error}
            disabled={disabled || loading}
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          disabled={disabled || loading}
          loading={loading}
          className="whitespace-nowrap"
        >
          Generate GIF →
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {/* Ratio control */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--text-muted)]">Ratio</span>
          <div className="flex rounded-lg overflow-hidden border border-[var(--border-subtle)]">
            {RATIO_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRatio(r)}
                disabled={disabled || loading}
                className={[
                  'px-3 py-1 text-xs font-mono transition-colors duration-150',
                  r === ratio
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                ].join(' ')}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Frames control */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--text-muted)]">Snaps</span>
          <div className="flex rounded-lg overflow-hidden border border-[var(--border-subtle)]">
            {FRAME_OPTIONS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFrames(f)}
                disabled={disabled || loading}
                className={[
                  'px-3 py-1 text-xs font-mono transition-colors duration-150',
                  f === frames
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                ].join(' ')}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Speed control */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--text-muted)]">Speed</span>
          <div className="flex rounded-lg overflow-hidden border border-[var(--border-subtle)]">
            {([0.5, 1, 2] as SpeedOption[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                disabled={disabled || loading}
                className={[
                  'px-3 py-1 text-xs font-mono transition-colors duration-150',
                  s === speed
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                ].join(' ')}
              >
                {SPEED_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.form>
  )
}

