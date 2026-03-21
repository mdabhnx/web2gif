---
name: web2gif-ui
description: Build the web2gif frontend UI components. Use when the user asks to build, implement, style, or fix the frontend, UI, components, design, or user interface for web2gif. Triggers for requests about the URL input form, job status display, GIF preview or download, progress indicators, the main page layout, dark theme styling, Framer Motion animations, or any visual aspect of the web2gif application.
---

# web2gif UI Implementation

## Design System

All colors are CSS custom properties defined in `src/app/globals.css`. **Never hardcode hex values in components.**

```
--bg-primary:    #0A0A0B   Main background
--bg-secondary:  #141416   Card backgrounds, panels
--bg-elevated:   #1C1C1F   Hover states, active cards
--accent-primary:#3B82F6   CTAs, links, focus rings
--accent-glow:   #60A5FA   Glow effects
--text-primary:  #FAFAFA   Headings, primary text
--text-secondary:#A1A1AA   Body text, descriptions
--text-muted:    #52525B   Placeholders, disabled
--border-subtle: #27272A   Card borders, dividers
--success:       #22C55E   Completion states
--error:         #EF4444   Error states
```

## Page State Machine

`src/app/page.tsx` is a **Client Component** (`'use client'`) managing:

```typescript
type AppState =
  | { phase: 'idle' }
  | { phase: 'submitting' }
  | { phase: 'polling'; jobId: string; progress: JobProgress }
  | { phase: 'complete'; jobId: string; gifUrl: string; meta: GifMeta }
  | { phase: 'error'; message: string }
```

Use `AnimatePresence` from Framer Motion with `mode="wait"` for phase transitions.

## Component: `src/components/UrlForm.tsx`

Props: `{ onSubmit: (url: string) => void; disabled: boolean }`

Features:
- Wide text input with placeholder `"https://example.com"`
- Validate URL client-side on submit (use `new URL(url)` — catch throws invalid)
- Auto-prepend `https://` if user types without a scheme
- Show inline red error text for invalid URLs
- "Generate GIF →" submit button, disabled when `disabled=true`
- On focus: input border transitions to `var(--accent-primary)` with box-shadow glow
- Framer Motion `fadeInUp` on mount: `{ y: 20, opacity: 0 } → { y: 0, opacity: 1 }`, duration 0.4s

```tsx
// Input styling target:
className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)]
           focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20
           rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
           font-mono text-sm outline-none transition-all duration-300"
```

## Component: `src/components/JobStatus.tsx`

Props: `{ jobId: string; onComplete: (gifUrl: string, meta: GifMeta) => void; onError: (msg: string) => void }`

Polling behavior:
- Poll `/api/status/${jobId}` every **1500ms** with `setInterval`
- Clean up interval on unmount (return from `useEffect`)
- On `COMPLETED`: fetch `/api/result/${jobId}`, call `onComplete`, stop polling
- On `FAILED`: call `onError`, stop polling

Display:
- Step labels: "Launching browser" → "Capturing frames" → "Encoding GIF" → "Uploading"
- Animated progress bar filling from 0 → 100% (smooth CSS width transition)
- Elapsed time counter in seconds
- Each step shows a spinner → checkmark (✓) on completion
- Subtle pulsing blue glow on the progress bar fill while active

## Component: `src/components/GifResult.tsx`

Props: `{ gifUrl: string; jobId: string; meta: GifMeta }`

Display:
- `<img src={gifUrl} />` — GIF auto-plays in browser
- File size formatted: `(meta.fileSize / 1_000_000).toFixed(1) + ' MB'`
- Frame count: `${meta.frameCount} frames`
- **Download button**: `<a href={gifUrl} download={jobId + '.gif'}>Download GIF</a>` — styled as primary CTA
- **Copy embed link**: copies `![website preview](${absoluteUrl})` to clipboard; shows "Copied!" toast for 2s
- **"Generate Another"** button: resets parent state to `{ phase: 'idle' }`
- Animate in: scale `0.95 → 1.0` + opacity `0 → 1`, duration 0.5s, spring easing

## Component: `src/components/ui/Button.tsx`

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  loading?: boolean
}
```

- `primary`: `bg-[var(--accent-primary)]` white text, `hover:shadow-[0_0_16px_var(--accent-glow)]`
- `secondary`: `bg-[var(--bg-elevated)]` `text-[var(--text-primary)]` border `var(--border-subtle)`
- `ghost`: transparent, `text-[var(--text-secondary)]`, hover `text-[var(--text-primary)]`
- All: `rounded-lg px-4 py-2`, `transition-all duration-200`, `hover:scale-[1.02]`
- `loading=true`: show a spinner (CSS `animate-spin` on a border-based circle), disable click

## Component: `src/components/ui/Input.tsx`

Thin wrapper around `<input>` that applies the design system styles (same as the styles in `UrlForm.tsx` above). Accepts all standard input props + `error?: string` for inline error display.

## Component: `src/components/ui/ProgressBar.tsx`

```typescript
interface ProgressBarProps {
  value: number       // 0–100
  animated?: boolean  // shimmer effect while processing
}
```

- Track: `h-2 rounded-full bg-[var(--bg-elevated)]`
- Fill: `bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-glow)]`
- `animated=true`: apply the `shimmer` Tailwind animation class (defined in `tailwind.config.ts`)
- Smooth width: `style={{ width: value + '%' }}` with `transition: width 0.3s ease`

## `src/app/globals.css`

Must include the CSS custom properties and Tailwind v4 import:

```css
@import "tailwindcss";

:root {
  --bg-primary:    #0A0A0B;
  --bg-secondary:  #141416;
  --bg-elevated:   #1C1C1F;
  --accent-primary:#3B82F6;
  --accent-glow:   #60A5FA;
  --text-primary:  #FAFAFA;
  --text-secondary:#A1A1AA;
  --text-muted:    #52525B;
  --border-subtle: #27272A;
  --success:       #22C55E;
  --error:         #EF4444;
}

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-geist-sans, system-ui, sans-serif);
}
```

## `src/app/layout.tsx`

```tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'web2gif — Turn any website into a GIF',
  description: 'Paste a URL and get a smooth animated GIF for your portfolio, README, or docs.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
```

## `src/app/page.tsx` Structure

```tsx
'use client'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import UrlForm from '@/components/UrlForm'
import JobStatus from '@/components/JobStatus'
import GifResult from '@/components/GifResult'

// Headline: "Turn any website into a GIF" — 48px, font-mono
// Subtitle: "Capture. Animate. Share." — 18px, text-secondary
// Then the appropriate phase component inside AnimatePresence
```

## Animation Conventions

- **Mount**: `initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4 }}`
- **Exit**: `exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.2 }}`
- Easing: `ease: [0.4, 0, 0.2, 1]` (Material ease-in-out) for all transitions
- Keep all animations under 400ms
- Stagger hero elements with 100ms delay between each (headline → subtitle → form)
