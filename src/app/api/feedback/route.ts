import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  let body: { jobId?: string; reason?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!body.jobId) {
    return Response.json({ error: 'jobId is required' }, { status: 400 })
  }

  const job = await db.job.findUnique({ where: { id: body.jobId } })
  if (!job) {
    return Response.json(
      { error: { code: 'JOB_NOT_FOUND', message: 'Job not found' } },
      { status: 404 }
    )
  }

  // Log feedback — extend with actual feedback table as needed
  console.log(`[feedback] Job ${body.jobId}: ${body.reason ?? 'no reason given'}`)

  return Response.json({ ok: true })
}
