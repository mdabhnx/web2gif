import fs from 'fs'
import path from 'path'
import { db } from '../src/lib/db'
import { uploadGif } from '../src/lib/storage'
import { captureScreenshots } from './screenshot'
import { encodeGif } from './gif'
import { PRESETS } from '../src/types/job'
import type { JobOptions } from '../src/types/job'

interface ProcessInput {
  jobId: string
  url: string
  options?: JobOptions
}

export async function processJob({ jobId, url, options }: ProcessInput): Promise<void> {
  const resolvedOptions = options ?? PRESETS.standard
  const tempDir = path.join('/tmp', `web2gif-${jobId}`)

  try {
    fs.mkdirSync(tempDir, { recursive: true })

    await db.job.update({
      where: { id: jobId },
      data: { status: 'PROCESSING', progress: JSON.stringify({ step: 'capturing', pct: 10 }) },
    })

    const framePaths = await captureScreenshots(url, resolvedOptions, tempDir)

    await db.job.update({
      where: { id: jobId },
      data: { progress: JSON.stringify({ step: 'encoding', pct: 50 }) },
    })

    const gifPath = await encodeGif(framePaths, resolvedOptions, tempDir)

    await db.job.update({
      where: { id: jobId },
      data: { progress: JSON.stringify({ step: 'uploading', pct: 80 }) },
    })

    const resultUrl = await uploadGif(gifPath, jobId)
    const stats = fs.statSync(gifPath)

    await db.job.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        result_url: resultUrl,
        file_size: stats.size,
        frame_count: framePaths.length,
        progress: JSON.stringify({ step: 'uploading', pct: 100 }),
      },
    })
  } catch (err) {
    await db.job.update({
      where: { id: jobId },
      data: { status: 'FAILED' },
    }).catch(() => {})
    throw err
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}
