---
name: web2gif-security
description: Implement security middleware for web2gif including SSRF prevention and rate limiting. Use when the user asks to add security, prevent SSRF attacks, block private IP ranges, implement rate limiting, add request throttling, protect the API, or harden the web2gif application. Also triggers for "users are abusing the API", "need to prevent internal network scanning", "add IP-based rate limiting", or "SSRF protection".
---

# web2gif Security Implementation

Two critical security layers for a URL-to-GIF service:
1. **SSRF prevention** — stop users from submitting `localhost`, private IPs, or cloud metadata endpoints to scan internal infrastructure via the headless browser
2. **Rate limiting** — each GIF job is expensive (Playwright + FFmpeg); prevent abuse

## File: `src/lib/ssrf.ts`

```typescript
import dns from 'dns/promises'

export interface SSRFCheckResult {
  safe: boolean
  reason?: string
}

export async function checkSSRF(rawUrl: string): Promise<SSRFCheckResult> {
  // 1. Parse URL — rejects malformed input
  let parsed: URL
  try { parsed = new URL(rawUrl) }
  catch { return { safe: false, reason: 'Invalid URL format' } }

  // 2. Scheme check
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { safe: false, reason: `Scheme "${parsed.protocol}" is not allowed` }
  }

  // 3. No auth info
  if (parsed.username || parsed.password) {
    return { safe: false, reason: 'URLs with credentials are not allowed' }
  }

  // 4. DNS resolution + private IP check
  let address: string
  try {
    const result = await dns.lookup(parsed.hostname)
    address = result.address
  } catch {
    return { safe: false, reason: 'Could not resolve hostname' }
  }

  if (isPrivateIP(address)) {
    return { safe: false, reason: 'Requests to private/internal IP ranges are not allowed' }
  }

  return { safe: true }
}

function isPrivateIP(ip: string): boolean {
  // IPv4 private ranges
  const parts = ip.split('.').map(Number)
  if (parts.length === 4) {
    const [a, b] = parts
    if (a === 127) return true                           // 127.0.0.0/8  loopback
    if (a === 10) return true                            // 10.0.0.0/8   RFC1918
    if (a === 172 && b >= 16 && b <= 31) return true    // 172.16.0.0/12 RFC1918
    if (a === 192 && b === 168) return true              // 192.168.0.0/16 RFC1918
    if (a === 169 && b === 254) return true              // 169.254.0.0/16 link-local / AWS metadata
    if (a === 100 && b >= 64 && b <= 127) return true   // 100.64.0.0/10 shared (RFC6598)
    if (a === 0) return true                             // 0.0.0.0/8
    if (a === 240) return true                           // 240.0.0.0/4 reserved
  }
  // IPv6 loopback
  if (ip === '::1') return true
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true  // fc00::/7 unique local
  if (ip.startsWith('fe80')) return true                        // fe80::/10 link-local
  return false
}
```

## File: `src/lib/rateLimit.ts`

Uses ioredis directly (no Upstash account needed for local dev):

```typescript
import { redis } from './redis'

export interface RateLimitResult {
  allowed: boolean
  reason?: string
  retryAfter?: number  // seconds
}

// Sliding window: count requests in the past `windowSecs` seconds
async function slidingWindow(
  key: string,
  limit: number,
  windowSecs: number
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = Date.now()
  const windowStart = now - windowSecs * 1000

  const pipe = redis.pipeline()
  pipe.zremrangebyscore(key, '-inf', windowStart)  // remove old entries
  pipe.zadd(key, now, `${now}-${Math.random()}`)   // add current request
  pipe.zcard(key)                                   // count in window
  pipe.expire(key, windowSecs)
  const results = await pipe.exec()

  const count = results?.[2]?.[1] as number
  if (count > limit) {
    // Oldest entry tells us when the window clears
    const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES')
    const oldestTime = oldest[1] ? parseInt(oldest[1]) : now
    const retryAfter = Math.ceil((oldestTime + windowSecs * 1000 - now) / 1000)
    return { allowed: false, retryAfter }
  }
  return { allowed: true }
}

export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  // Tier 1: 5 requests per minute
  const minute = await slidingWindow(`rl:min:${ip}`, 5, 60)
  if (!minute.allowed) {
    return {
      allowed: false,
      reason: `Rate limit exceeded. Try again in ${minute.retryAfter} seconds.`,
      retryAfter: minute.retryAfter,
    }
  }

  // Tier 2: 50 requests per day
  const daily = await slidingWindow(`rl:day:${ip}`, 50, 86400)
  if (!daily.allowed) {
    return {
      allowed: false,
      reason: `Daily limit reached. Try again tomorrow.`,
      retryAfter: daily.retryAfter,
    }
  }

  return { allowed: true }
}
```

## Applying in `/api/generate/route.ts`

Add these checks at the top of the `POST` handler, before any job creation:

```typescript
import { checkSSRF } from '@/lib/ssrf'
import { checkRateLimit } from '@/lib/rateLimit'

// 1. Real IP (handle reverse proxies)
const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? req.headers.get('x-real-ip')
        ?? '127.0.0.1'

// 2. Rate limit
const rl = await checkRateLimit(ip)
if (!rl.allowed) {
  return Response.json(
    { error: { code: 'RATE_LIMIT_EXCEEDED', message: rl.reason, retryAfter: rl.retryAfter } },
    { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } }
  )
}

// 3. SSRF check
const body = await req.json()
const ssrf = await checkSSRF(body.url ?? '')
if (!ssrf.safe) {
  return Response.json(
    { error: { code: 'INVALID_URL', message: ssrf.reason } },
    { status: 400 }
  )
}
```

## Security Headers (already in `next.config.ts`)

```typescript
{ key: 'X-Content-Type-Options', value: 'nosniff' },
{ key: 'X-Frame-Options', value: 'DENY' },
{ key: 'X-XSS-Protection', value: '1; mode=block' },
```

## Domain Blocklist (optional enhancement)

Maintain `src/lib/blocklist.ts` with a `Set<string>` of blocked hostnames:
```typescript
export const BLOCKED_DOMAINS = new Set([
  'metadata.google.internal',
  'instance-data',        // AWS EC2 metadata alternative hostname
])

export function isDomainBlocked(hostname: string): boolean {
  return BLOCKED_DOMAINS.has(hostname) ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.corp')
}
```

Call `isDomainBlocked(parsed.hostname)` at the start of `checkSSRF` before DNS resolution.

## Testing Security

```bash
# Should be rejected (private IP)
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"url":"http://192.168.1.1"}'
# → 400 {"error":{"code":"INVALID_URL","message":"Requests to private/internal IP ranges are not allowed"}}

# Should be rejected (localhost)
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"url":"http://localhost:8080/admin"}'
# → 400

# Spam to test rate limit (run 6 times quickly)
for i in {1..6}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/generate \
    -H "Content-Type: application/json" -d '{"url":"https://example.com"}'
done
# First 5: 202, 6th: 429
```
