'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import UrlForm from '@/components/UrlForm'
import JobStatus from '@/components/JobStatus'
import GifResult from '@/components/GifResult'
import type { GifMeta } from '@/types/job'

type AppState =
  | { phase: 'idle' }
  | { phase: 'submitting' }
  | { phase: 'polling'; jobId: string }
  | { phase: 'complete'; jobId: string; gifUrl: string; meta: GifMeta }
  | { phase: 'error'; message: string }

const fadeUp = {
  initial: { y: 20, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: -10, opacity: 0 },
  transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
}

export default function Home() {
  const [state, setState] = useState<AppState>({ phase: 'idle' })

  async function handleSubmit(url: string) {
    setState({ phase: 'submitting' })
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) {
        setState({ phase: 'error', message: data.error?.message ?? 'Something went wrong' })
        return
      }
      setState({ phase: 'polling', jobId: data.jobId })
    } catch {
      setState({ phase: 'error', message: 'Network error. Please try again.' })
    }
  }

  function handleComplete(gifUrl: string, meta: GifMeta) {
    setState((s) =>
      s.phase === 'polling'
        ? { phase: 'complete', jobId: s.jobId, gifUrl, meta }
        : s
    )
  }

  function handleError(message: string) {
    setState({ phase: 'error', message })
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl space-y-10">
        {/* Hero */}
        <div className="text-center space-y-4">
          <motion.h1
            className="text-5xl font-mono font-bold text-[var(--text-primary)] leading-tight"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0, ease: [0.4, 0, 0.2, 1] }}
          >
            Turn any website into a GIF
          </motion.h1>
          <motion.p
            className="text-lg text-[var(--text-secondary)]"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
          >
            Capture. Animate. Share.
          </motion.p>
        </div>

        {/* Card */}
        <motion.div
          className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-2xl p-6 sm:p-8"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
        >
          <AnimatePresence mode="wait">
            {(state.phase === 'idle' || state.phase === 'error') && (
              <motion.div key="form" {...fadeUp} className="space-y-4">
                <UrlForm
                  onSubmit={handleSubmit}
                  disabled={false}
                />
                {state.phase === 'error' && (
                  <p className="text-sm text-[var(--error)]">{state.message}</p>
                )}
              </motion.div>
            )}

            {state.phase === 'submitting' && (
              <motion.div key="submitting" {...fadeUp} className="flex justify-center py-8">
                <span className="inline-block w-8 h-8 rounded-full border-2 border-[var(--accent-primary)]/30 border-t-[var(--accent-primary)] animate-spin" />
              </motion.div>
            )}

            {state.phase === 'polling' && (
              <motion.div key="polling" {...fadeUp}>
                <JobStatus
                  jobId={state.jobId}
                  onComplete={handleComplete}
                  onError={handleError}
                />
              </motion.div>
            )}

            {state.phase === 'complete' && (
              <motion.div key="complete" {...fadeUp}>
                <GifResult
                  gifUrl={state.gifUrl}
                  jobId={state.jobId}
                  meta={state.meta}
                  onReset={() => setState({ phase: 'idle' })}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </main>
  )
}
