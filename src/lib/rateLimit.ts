// In-memory sliding window rate limiter (no Redis needed for local dev)

export interface RateLimitResult {
  allowed: boolean
  reason?: string
  retryAfter?: number
}

interface WindowEntry {
  timestamps: number[]
}

const store = new Map<string, WindowEntry>()

function slidingWindow(
  key: string,
  limit: number,
  windowSecs: number
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const windowStart = now - windowSecs * 1000

  let entry = store.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Prune old entries
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart)

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0]
    const retryAfter = Math.ceil((oldest + windowSecs * 1000 - now) / 1000)
    return { allowed: false, retryAfter }
  }

  entry.timestamps.push(now)
  return { allowed: true }
}

export function checkRateLimit(ip: string): RateLimitResult {
  const minute = slidingWindow(`rl:min:${ip}`, 5, 60)
  if (!minute.allowed) {
    return {
      allowed: false,
      reason: `Rate limit exceeded. Try again in ${minute.retryAfter} seconds.`,
      retryAfter: minute.retryAfter,
    }
  }

  const daily = slidingWindow(`rl:day:${ip}`, 50, 86400)
  if (!daily.allowed) {
    return {
      allowed: false,
      reason: 'Daily limit reached. Try again tomorrow.',
      retryAfter: daily.retryAfter,
    }
  }

  return { allowed: true }
}
