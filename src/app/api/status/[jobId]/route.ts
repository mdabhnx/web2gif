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

  return Response.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress ? JSON.parse(job.progress) : null,
  })
}
