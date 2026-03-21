'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

interface UrlFormProps {
  onSubmit: (url: string) => void
  disabled: boolean
}

export default function UrlForm({ onSubmit, disabled }: UrlFormProps) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    let finalUrl = url.trim()
    if (!finalUrl) {
      setError('Please enter a URL')
      return
    }

    // Auto-prepend https:// if missing scheme
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = `https://${finalUrl}`
    }

    try {
      new URL(finalUrl)
    } catch {
      setError('Please enter a valid URL')
      return
    }

    onSubmit(finalUrl)
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="w-full flex flex-col sm:flex-row gap-3"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="flex-1">
        <Input
          type="text"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          error={error}
          disabled={disabled}
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        disabled={disabled}
        className="whitespace-nowrap"
      >
        Generate GIF →
      </Button>
    </motion.form>
  )
}
