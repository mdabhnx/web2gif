import { NextRequest } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db'
import { checkSSRF } from '@/lib/ssrf'
import { checkRateLimit } from '@/lib/rateLimit'
import { PRESETS, RATIO_VALUES, type GifPreset, type AspectRatio } from '@/types/job'

export async function POST(req: NextRequest) {
  // 1. Real IP
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'

  // 2. Rate limit (in-memory)
  const rl = checkRateLimit(ip)
  if (!rl.allowed) {
    return Response.json(
      { error: { code: 'RATE_LIMIT_EXCEEDED', message: rl.reason, retryAfter: rl.retryAfter } },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } }
    )
  }

  // 3. Parse body
  let body: { url?: string; options?: { preset?: GifPreset; speed?: number; frames?: number; ratio?: AspectRatio } }
  try {
    body = await req.json()
  } catch {
    return Response.json(
      { error: { code: 'INVALID_URL', message: 'Invalid request body' } },
      { status: 400 }
    )
  }

  // 4. SSRF check
  const ssrf = await checkSSRF(body.url ?? '')
  if (!ssrf.safe) {
    return Response.json(
      { error: { code: 'INVALID_URL', message: ssrf.reason } },
      { status: 400 }
    )
  }

  // 5. Resolve options
  const preset = (body.options?.preset ?? 'standard') as GifPreset
  const base = PRESETS[preset] ?? PRESETS.standard
  const speedMultiplier = Math.max(0.25, Math.min(4, body.options?.speed ?? 1))
  const frames = body.options?.frames != null
    ? Math.max(4, Math.min(60, Math.round(body.options.frames)))
    : base.frames

  const selectedRatio = (body.options?.ratio ?? '16:9') as AspectRatio
  const ratioVal = RATIO_VALUES[selectedRatio]
  
  let height = base.height
  if (typeof ratioVal === 'number') {
    height = Math.round(base.width * ratioVal)
  } else if (ratioVal === 'full') {
    // Height will be determined by page content in worker
    height = -1 // Special flag for full height
  }

  const options = { ...base, height, fps: Math.round(base.fps * speedMultiplier), frames, ratio: selectedRatio }

  // 6. Create DB record (status=PENDING — worker polls and picks up)
  const jobId = uuidv4()
  await db.job.create({
    data: {
      id: jobId,
      url: body.url!,
      status: 'PENDING',
      options: JSON.stringify(options),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  })

  const estimatedTime = preset === 'high' ? 30 : preset === 'standard' ? 18 : 12
  return Response.json({ jobId, estimatedTime }, { status: 202 })
}
