import { config } from 'dotenv'
config({ path: '.env.local' })
config()

import { db } from '../src/lib/db'
import { processJob } from './processor'
import type { JobOptions } from '../src/types/job'

const POLL_INTERVAL_MS = 2000
const MAX_CONCURRENCY = 2

const running = new Set<string>()

async function poll() {
  if (running.size >= MAX_CONCURRENCY) return

  const slots = MAX_CONCURRENCY - running.size

  const jobs = await db.job.findMany({
    where: { status: 'PENDING' },
    orderBy: { created_at: 'asc' },
    take: slots,
  })

  for (const job of jobs) {
    // Atomically claim the job (prevent double-processing if multiple workers run)
    const claimed = await db.job.updateMany({
      where: { id: job.id, status: 'PENDING' },
      data: { status: 'PROCESSING' },
    })
    if (claimed.count === 0) continue

    running.add(job.id)
    const options = job.options ? (JSON.parse(job.options) as JobOptions) : undefined

    console.log(`[worker] ${new Date().toISOString()} Starting job ${job.id}`)

    processJob({ jobId: job.id, url: job.url, options })
      .then(() => console.log(`[worker] ${new Date().toISOString()} Completed job ${job.id}`))
      .catch((err) => console.error(`[worker] ${new Date().toISOString()} Failed job ${job.id}:`, err.message))
      .finally(() => running.delete(job.id))
  }
}

console.log(`[worker] ${new Date().toISOString()} Worker started — polling SQLite every ${POLL_INTERVAL_MS}ms`)

poll()
const interval = setInterval(poll, POLL_INTERVAL_MS)

async function shutdown() {
  console.log('[worker] Shutting down...')
  clearInterval(interval)
  await db.$disconnect()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
