'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import ProgressBar from '@/components/ui/ProgressBar'
import type { GifMeta, JobProgress } from '@/types/job'

interface JobStatusProps {
  jobId: string
  onComplete: (gifUrl: string, meta: GifMeta) => void
  onError: (msg: string) => void
}

const STEPS = [
  { key: 'capturing', label: 'Launching browser & capturing frames' },
  { key: 'encoding',  label: 'Encoding GIF' },
  { key: 'uploading', label: 'Uploading' },
]

export default function JobStatus({ jobId, onComplete, onError }: JobStatusProps) {
  const [progress, setProgress] = useState<JobProgress>({ step: 'capturing', pct: 0 })
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)

    async function poll() {
      try {
        const res = await fetch(`/api/status/${jobId}`)
        const data = await res.json()

        if (data.progress) setProgress(data.progress as JobProgress)

        if (data.status === 'COMPLETED') {
          clearInterval(intervalRef.current!)
          clearInterval(timerRef.current!)
          const resultRes = await fetch(`/api/result/${jobId}`)
          const result = await resultRes.json()
          onComplete(result.result.gifUrl, {
            fileSize: result.result.fileSize,
            frameCount: result.result.frameCount,
          })
        } else if (data.status === 'FAILED') {
          clearInterval(intervalRef.current!)
          clearInterval(timerRef.current!)
          onError('GIF generation failed. Please try again.')
        }
      } catch {
        // Network errors are transient — keep polling
      }
    }

    poll()
    intervalRef.current = setInterval(poll, 1500)

    return () => {
      clearInterval(intervalRef.current!)
      clearInterval(timerRef.current!)
    }
  }, [jobId, onComplete, onError])

  const currentStepIdx = STEPS.findIndex((s) => s.key === progress.step)

  return (
    <motion.div
      className="w-full space-y-6"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -10, opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="flex justify-between items-center text-sm">
        <span className="text-[var(--text-secondary)]">Processing...</span>
        <span className="text-[var(--text-muted)] font-mono">{elapsed}s elapsed</span>
      </div>

      <ProgressBar value={progress.pct} animated />

      <div className="space-y-3">
        {STEPS.map((step, idx) => {
          const done = idx < currentStepIdx
          const active = idx === currentStepIdx
          return (
            <div
              key={step.key}
              className={`flex items-center gap-3 text-sm transition-colors ${
                done
                  ? 'text-[var(--success)]'
                  : active
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              <span className="w-4 text-center">
                {done ? (
                  '✓'
                ) : active ? (
                  <span className="inline-block w-3 h-3 rounded-full border-2 border-[var(--accent-primary)]/30 border-t-[var(--accent-primary)] animate-spin" />
                ) : (
                  '○'
                )}
              </span>
              {step.label}
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
