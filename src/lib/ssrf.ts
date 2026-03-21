import dns from 'dns/promises'

export interface SSRFCheckResult {
  safe: boolean
  reason?: string
}

export async function checkSSRF(rawUrl: string): Promise<SSRFCheckResult> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { safe: false, reason: 'Invalid URL format' }
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { safe: false, reason: `Scheme "${parsed.protocol}" is not allowed` }
  }

  if (parsed.username || parsed.password) {
    return { safe: false, reason: 'URLs with credentials are not allowed' }
  }

  if (isDomainBlocked(parsed.hostname)) {
    return { safe: false, reason: 'This domain is not allowed' }
  }

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

function isDomainBlocked(hostname: string): boolean {
  const BLOCKED_DOMAINS = new Set([
    'metadata.google.internal',
    'instance-data',
  ])
  return (
    BLOCKED_DOMAINS.has(hostname) ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.corp')
  )
}

function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length === 4) {
    const [a, b] = parts
    if (a === 127) return true
    if (a === 10) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    if (a === 0) return true
    if (a === 240) return true
  }
  if (ip === '::1') return true
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true
  if (ip.startsWith('fe80')) return true
  return false
}
