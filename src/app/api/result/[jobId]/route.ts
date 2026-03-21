import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params
  const job = await db.job.findUnique({ where: { id: jobId } })

  if (!job) {
    return Response.json(
      { error: { code: 'JOB_NOT_FOUND', message: 'Job not found' } },
      { status: 404 }
    )
  }

  if (job.expires_at && job.expires_at < new Date()) {
    return Response.json(
      { error: { code: 'JOB_EXPIRED', message: 'This GIF has expired' } },
      { status: 410 }
    )
  }

  if (job.status !== 'COMPLETED') {
    return Response.json(
      { error: { code: 'JOB_NOT_FOUND', message: `Job is ${job.status}` } },
      { status: 404 }
    )
  }

  return Response.json({
    jobId: job.id,
    status: job.status,
    result: {
      gifUrl: job.result_url,
      fileSize: job.file_size,
      frameCount: job.frame_count,
    },
    expiresAt: job.expires_at,
  })
}
