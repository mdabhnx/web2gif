---
name: web2gif-scaffold
description: Scaffold the web2gif project foundation. Use when the user asks to set up, initialize, scaffold, or bootstrap the web2gif project. Also triggers for "create the base files", "initialize web2gif", "get the project started", "create package.json", "set up docker-compose", or "run prisma migrate" for web2gif.
---

# web2gif Scaffold

Scaffold the complete web2gif project foundation and verify local dev is running.

## Context

web2gif converts any URL to an animated GIF using:
- Next.js 15 + React 19 (App Router) — frontend and API routes
- BullMQ + Redis — async job queue (workers are **separate** Node.js processes, NOT inside Next.js)
- Playwright Chromium — screenshot capture (lives only in `worker/`)
- FFmpeg + gifski + gifsicle — GIF encoding
- PostgreSQL + Prisma — job tracking
- Local filesystem (`public/outputs/`) or AWS S3/R2 — GIF storage, toggled by `STORAGE_DRIVER` env var

Project root: `/Users/mdabidhossain/Development/si.hu/ar51/web2gif/`

## Step 1: Verify Prerequisites

```bash
node --version    # Need v20+
docker --version
which ffmpeg   || echo "MISSING: brew install ffmpeg"
which gifski   || echo "MISSING: brew install gifski"
which gifsicle || echo "MISSING: brew install gifsicle"
```

If any CLI tools are missing, tell the user:
```bash
brew install ffmpeg gifski gifsicle
```

## Step 2: Read CLAUDE.md

Read `/Users/mdabidhossain/Development/si.hu/ar51/web2gif/CLAUDE.md` for the full architecture context before writing any code.

## Step 3: Install Dependencies

```bash
cd /Users/mdabidhossain/Development/si.hu/ar51/web2gif
npm install
npx playwright install chromium
```

## Step 4: Set Up Environment

```bash
cp .env.example .env.local
# Review .env.local — defaults work for local dev (no changes needed)
```

## Step 5: Start Infrastructure

```bash
docker-compose up -d
# Wait for healthy status:
docker-compose ps
```

## Step 6: Run DB Migration

```bash
npx prisma migrate dev --name init
npx prisma generate
```

## Step 7: Verify Everything Works

Open **two terminals**:

**Terminal 1:**
```bash
npm run dev
# Next.js starts on http://localhost:3000
```

**Terminal 2:**
```bash
npm run worker
# BullMQ worker connects to Redis and waits for jobs
```

Then verify:
```bash
curl http://localhost:3000/api/health
# → {"status":"ok","timestamp":"..."}
```

## Step 8: Test End-to-End

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
# → {"jobId":"...","estimatedTime":18}

# Poll status:
curl http://localhost:3000/api/status/<jobId>
```

## Notes

- Never import Playwright in `src/app/` or `src/lib/` — Playwright only belongs in `worker/`
- `STORAGE_DRIVER=local` saves GIFs to `public/outputs/{jobId}.gif` — no S3 needed for dev
- Redis: `redis://localhost:6379` | Postgres: `postgresql://web2gif:web2gif@localhost:5432/web2gif`
- After `npm install`, always run `npx prisma generate` to regenerate the Prisma client
