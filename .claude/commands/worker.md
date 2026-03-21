---
name: web2gif-worker
description: Implement the BullMQ worker process for web2gif. Use when the user asks to implement, build, or fix the worker, the GIF generation pipeline, the screenshot capture, Playwright browser automation, FFmpeg encoding, gifski step, gifsicle optimization, or frame capture for web2gif. Also triggers for "worker isn't processing jobs", "screenshots not being taken", "GIF not generating", or "BullMQ processor".
---

# web2gif Worker Implementation

The worker is a **long-running Node.js process** (NOT a Next.js route) that:
1. Pulls jobs from the BullMQ `gif-generation` queue
2. Launches Playwright Chromium, scrolls the page, captures PNG frames
3. Encodes frames → GIF via gifski (FFmpeg fallback)
4. Optimizes with gifsicle
5. Uploads to S3 or saves locally
6. Updates job status in PostgreSQL via Prisma

## Always Read First

Read `CLAUDE.md` and `src/lib/queue.ts` before implementing. The queue name and job data shape must match exactly what `/api/generate` enqueues.

## Architecture Invariants

- Worker lives entirely in `worker/` — never imported by Next.js
- Frames written to `/tmp/web2gif-<jobId>/` — always cleaned up in `finally` block
- Browser instance is created fresh per job and closed after
- Job status: `PENDING → PROCESSING → COMPLETED | FAILED`
- On failure: BullMQ retries up to 3 times with exponential backoff, then `FAILED`

## File: `worker/index.ts`

Entry point. Responsibilities:
- Load `dotenv` (reads `.env.local`)
- Connect to Redis via `src/lib/redis.ts`
- Create a `BullMQ Worker` on the `gif-generation` queue
- Pass jobs to the processor in `worker/processor.ts`
- Log all lifecycle events (job start, complete, fail) with timestamps
- Handle graceful shutdown on `SIGTERM`/`SIGINT` (close browser, drain queue)

```typescript
import 'dotenv/config'
import { Worker } from 'bullmq'
import { redis } from '../src/lib/redis'
import { processJob } from './processor'

const worker = new Worker('gif-generation', processJob, {
  connection: redis,
  concurrency: 2,
})

worker.on('completed', (job) => console.log(`[worker] Job ${job.id} completed`))
worker.on('failed', (job, err) => console.error(`[worker] Job ${job?.id} failed:`, err.message))

process.on('SIGTERM', async () => { await worker.close(); process.exit(0) })
process.on('SIGINT',  async () => { await worker.close(); process.exit(0) })
```

## File: `worker/processor.ts`

BullMQ job processor. Job data shape:
```typescript
interface JobData {
  jobId: string        // UUID — matches DB record
  url: string
  options: {
    width: number      // default: 1280
    height: number     // default: 720
    fps: number        // default: 10
    duration: number   // seconds of capture, default: 3
    quality: number    // gifski 1–100, default: 80
  }
}
```

Processing steps:
1. Create temp dir: `/tmp/web2gif-${jobId}/`
2. Update DB: `status = 'PROCESSING'`, `progress = { step: 'capturing', pct: 10 }`
3. Call `captureScreenshots(url, options, tempDir)` → PNG paths array
4. Update DB: `progress = { step: 'encoding', pct: 50 }`
5. Call `encodeGif(framePaths, options, tempDir)` → optimized GIF path
6. Update DB: `progress = { step: 'uploading', pct: 80 }`
7. Call `uploadGif(gifPath, jobId)` → public URL string
8. Update DB: `status = 'COMPLETED'`, `result_url`, `file_size`, `frame_count`
9. **Always** clean up temp dir in `finally`

On any uncaught error: set `status = 'FAILED'`, re-throw so BullMQ handles retries.

## File: `worker/screenshot.ts`

```typescript
export async function captureScreenshots(
  url: string,
  options: { width: number; height: number; fps: number; duration: number },
  tempDir: string
): Promise<string[]>
```

Implementation:
- `chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] })`
- `context.newPage()` → set viewport `{ width, height }`
- `page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })`
- Wait 800ms for animations to settle
- Total frames = `fps × duration`
- Interval between frames = `1000 / fps` ms
- Use `page.screenshot({ type: 'png', path: join(tempDir, `frame-${String(i).padStart(4,'0')}.png`) })`
- Between frames: `await page.waitForTimeout(1000 / fps)`
- Close browser after all frames captured
- Return sorted array of absolute frame paths

Error handling:
- Timeout → throw `new Error('Page load timeout')`
- Non-2xx status → throw `new Error('Site returned HTTP ${status}')`

## File: `worker/gif.ts`

### `encodeGif(framePaths, options, tempDir)` → string (path to final GIF)

**Primary path (gifski):**
```bash
gifski --fps {fps} --quality {quality} --width {width} -o {tempDir}/output.gif {tempDir}/frame-*.png
```

**Fallback (if gifski not found):**
```bash
# Step 1: palette
ffmpeg -i {tempDir}/frame-%04d.png -vf "fps={fps},scale={width}:-1:flags=lanczos,palettegen=stats_mode=diff" {tempDir}/palette.png

# Step 2: encode
ffmpeg -i {tempDir}/frame-%04d.png -i {tempDir}/palette.png \
  -lavfi "fps={fps},scale={width}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer" \
  {tempDir}/output.gif
```

**Always run gifsicle optimization:**
```bash
gifsicle -O3 --lossy=30 {tempDir}/output.gif -o {tempDir}/final.gif
```

Use `child_process.execFile` (not `exec`) for all CLI calls — prevents shell injection.
Use `which gifski` to detect whether gifski is available.

### `uploadGif(gifPath, jobId)` → string (public URL)

Check `process.env.STORAGE_DRIVER`:
- `'local'`: `fs.copyFileSync(gifPath, join(process.cwd(), 'public/outputs', jobId + '.gif'))` → return `/outputs/${jobId}.gif`
- `'s3'`: Use `@aws-sdk/client-s3` with `PutObjectCommand` → return `${process.env.S3_PUBLIC_URL}/${jobId}.gif`

## Running the Worker

```bash
npm run worker       # production-style (ts-node)
npm run worker:dev   # nodemon watch mode for development
```

The `tsconfig.json` has a `ts-node` override block (`module: "CommonJS"`) — this is required. Do NOT create a separate tsconfig for the worker.

## Testing Without the UI

```bash
# 1. docker-compose up -d
# 2. npm run worker (Terminal 1)
# 3. npm run dev (Terminal 2)
# 4. Submit a job:
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
# 5. Poll:
curl http://localhost:3000/api/status/<jobId>
# 6. Check output:
open public/outputs/<jobId>.gif
```
