# web2gif — Project Context

## What This Is
A web application that converts any URL to an animated GIF. User submits a URL → headless browser (Playwright) captures N screenshots → FFmpeg + gifski encodes an optimized GIF → download link returned.

**Use cases:** portfolio showcases, README demos, case studies, social media previews.

---

## Architecture

```
Browser → Next.js API → BullMQ Queue → Worker Process → GIF Pipeline → Storage
                ↕                           ↕
           PostgreSQL                   PostgreSQL
```

### Critical Constraint: Worker Separation
Playwright **cannot** run inside Next.js API routes (serverless/edge incompatible). The `worker/` directory is a completely **separate long-running Node.js process**:

```bash
# Two terminals in dev:
npm run dev       # Next.js on :3000
npm run worker    # BullMQ worker (reads same .env.local)
```

### Storage Toggle
- `STORAGE_DRIVER=local` → saves GIFs to `public/outputs/{jobId}.gif` → served statically by Next.js
- `STORAGE_DRIVER=s3`    → uploads to S3/R2 → returns CDN URL

---

## Job Lifecycle

1. `POST /api/generate` — validates URL (SSRF + rate limit), creates DB record (`status=PENDING`), enqueues to BullMQ, returns `{ jobId, estimatedTime }`
2. Worker picks up job → sets `PROCESSING` → captures screenshots → encodes GIF → uploads → sets `COMPLETED` with `result_url`
3. Frontend polls `GET /api/status/:jobId` every 1.5s
4. On `COMPLETED` → frontend fetches `GET /api/result/:jobId` to show/download

**Status values:** `PENDING` | `PROCESSING` | `COMPLETED` | `FAILED`

---

## Key Patterns

### Prisma singleton
Always use `src/lib/db.ts`. Never `new PrismaClient()` directly in routes or components.

### Redis singleton
Always use `src/lib/redis.ts`. Never `new Redis()` ad-hoc.

### Queue name
`gif-generation` — defined once in `src/lib/queue.ts`, imported by both the API route (producer) and the worker (consumer). A typo here causes silent failures (jobs enqueued to one queue, worker listening on another).

### Security layers (apply in `/api/generate`)
1. Rate limit check (`src/lib/rateLimit.ts`) — per-IP sliding window
2. SSRF check (`src/lib/ssrf.ts`) — DNS resolution + private IP range blocking
3. Only then: enqueue the job

---

## Tech Versions
- Next.js 15 (App Router) + React 19
- Tailwind CSS v4 (CSS-first config, `@import "tailwindcss"` in globals.css)
- BullMQ 5.x + ioredis 5.x
- Playwright 1.x (Chromium)
- Prisma 5.x + PostgreSQL 16
- Redis 7
- FFmpeg + gifski + gifsicle (system binaries via `brew install`)

---

## File Structure

```
src/
  app/
    api/
      generate/route.ts       ← POST: validate + enqueue
      status/[jobId]/route.ts ← GET: poll job progress
      result/[jobId]/route.ts ← GET: fetch completed result
      health/route.ts         ← GET: {"status":"ok"}
      feedback/route.ts       ← POST: report bad results
    layout.tsx
    page.tsx                  ← Client component, state machine
    globals.css               ← CSS variables + Tailwind import
  components/
    UrlForm.tsx
    JobStatus.tsx
    GifResult.tsx
    ui/
      Button.tsx
      Input.tsx
      ProgressBar.tsx
  lib/
    db.ts         ← Prisma singleton
    redis.ts      ← ioredis singleton
    queue.ts      ← BullMQ queue + job type definitions
    storage.ts    ← local/S3 upload abstraction
    ssrf.ts       ← SSRF prevention (DNS + IP range check)
    rateLimit.ts  ← sliding window rate limiter
  types/
    job.ts        ← shared TypeScript types

worker/
  index.ts        ← BullMQ Worker entry point
  processor.ts    ← job handler (orchestrates screenshot + encode + upload)
  screenshot.ts   ← Playwright capture pipeline
  gif.ts          ← FFmpeg + gifski + gifsicle encoding

prisma/
  schema.prisma
```

---

## Design System

CSS custom properties (defined in `src/app/globals.css`):

| Token | Value | Usage |
|---|---|---|
| `--bg-primary` | `#0A0A0B` | Main background |
| `--bg-secondary` | `#141416` | Card backgrounds |
| `--bg-elevated` | `#1C1C1F` | Hover states |
| `--accent-primary` | `#3B82F6` | CTAs, focus rings |
| `--accent-glow` | `#60A5FA` | Glow effects |
| `--text-primary` | `#FAFAFA` | Headings |
| `--text-secondary` | `#A1A1AA` | Body text |
| `--text-muted` | `#52525B` | Placeholders |
| `--border-subtle` | `#27272A` | Borders |
| `--success` | `#22C55E` | Success states |
| `--error` | `#EF4444` | Error states |

**Never hardcode hex values in components. Always use `var(--token-name)`.**

---

## Dev Commands

```bash
docker-compose up -d          # Start Redis + Postgres
npm run dev                   # Next.js on :3000
npm run worker                # BullMQ worker
npm run worker:dev            # Worker with nodemon (auto-restart)
npx prisma studio             # Browse database at :5555
npx prisma migrate dev        # Create + run new migration
npx prisma generate           # Regenerate Prisma client (after schema changes)
```

---

## API Reference

### POST /api/generate
```json
Request:  { "url": "https://example.com", "options": { "preset": "standard" } }
Response: { "jobId": "uuid", "estimatedTime": 18 }
```

### GET /api/status/:jobId
```json
{ "jobId": "...", "status": "PROCESSING", "progress": { "step": "capturing", "pct": 45 } }
```

### GET /api/result/:jobId
```json
{ "jobId": "...", "status": "COMPLETED", "result": { "gifUrl": "...", "fileSize": 2340000, "frameCount": 30 }, "expiresAt": "..." }
```

### Error format
```json
{ "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "...", "retryAfter": 60 } }
```

**Error codes:** `INVALID_URL` (400) | `BLOCKED_DOMAIN` (403) | `RATE_LIMIT_EXCEEDED` (429) | `SITE_UNREACHABLE` (502) | `GENERATION_FAILED` (500) | `JOB_NOT_FOUND` (404) | `JOB_EXPIRED` (410)

---

## GIF Output Presets

| Preset | Resolution | Frames | FPS | Target Size |
|---|---|---|---|---|
| thumbnail | 480×300 | 8 | 4 | < 1 MB |
| standard | 800×500 | 12 | 6 | < 3 MB |
| high | 1200×750 | 15 | 8 | < 8 MB |
| mobile | 375×667 | 10 | 5 | < 2 MB |

---

## Skills Available

Use these slash commands for implementation help:
- `/web2gif-scaffold` — set up project deps, docker, migrations
- `/web2gif-worker`   — implement the BullMQ + Playwright + GIF pipeline
- `/web2gif-security` — SSRF prevention + rate limiting
- `/web2gif-ui`       — frontend components per design spec
