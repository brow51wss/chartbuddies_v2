import type { NextApiRequest, NextApiResponse } from 'next'

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

function prune(now: number) {
  if (buckets.size < 500) return
  buckets.forEach((bucket, key) => {
    if (now >= bucket.resetAt) buckets.delete(key)
  })
}

export function clientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim().slice(0, 128)
  }
  return req.socket.remoteAddress || 'unknown'
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now()
  prune(now)
  const existing = buckets.get(key)
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfterSec: 0 }
  }
  if (existing.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) }
  }
  existing.count += 1
  return { ok: true, retryAfterSec: 0 }
}

export function rejectTooMany(res: NextApiResponse, retryAfterSec: number) {
  res.setHeader('Retry-After', String(retryAfterSec))
  res.setHeader('Cache-Control', 'no-store')
  return res.status(429).json({ error: 'Too many attempts. Try again shortly.' })
}
