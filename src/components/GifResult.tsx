'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Button from '@/components/ui/Button'
import type { GifMeta } from '@/types/job'

interface GifResultProps {
  gifUrl: string
  jobId: string
  meta: GifMeta
  onReset: () => void
}

export default function GifResult({ gifUrl, jobId, meta, onReset }: GifResultProps) {
  const [copied, setCopied] = useState(false)

  const absoluteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${gifUrl}`
    : gifUrl

  async function copyEmbed() {
    await navigator.clipboard.writeText(`![website preview](${absoluteUrl})`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      className="w-full space-y-6"
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ y: -10, opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={gifUrl} alt="Generated GIF" className="w-full" />
      </div>

      <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
        <span>{(meta.fileSize / 1_000_000).toFixed(1)} MB</span>
        <span className="text-[var(--border-subtle)]">·</span>
        <span>{meta.frameCount} frames</span>
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href={gifUrl}
          download={`${jobId}.gif`}
          className="rounded-lg px-4 py-2 font-medium transition-all duration-200 hover:scale-[1.02] bg-[var(--accent-primary)] text-white hover:shadow-[0_0_16px_var(--accent-glow)]"
        >
          Download GIF
        </a>

        <Button variant="secondary" onClick={copyEmbed}>
          {copied ? 'Copied!' : 'Copy embed link'}
        </Button>

        <Button variant="ghost" onClick={onReset}>
          Generate Another
        </Button>
      </div>
    </motion.div>
  )
}
