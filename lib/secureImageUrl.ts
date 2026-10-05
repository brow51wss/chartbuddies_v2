import { supabase } from './supabase'

/**
 * Resolves `/api/signature-image?key=...` (login required, returns JSON `{ url }`)
 * into a short-lived signed S3 URL that can be loaded straight into <img>.
 *
 * - Sends the user's Supabase access token (an <img src> request cannot).
 * - Caches resolved URLs in memory for 50 min (server signs for 60 min).
 * - De-duplicates concurrent lookups for the same key.
 * - Never caches failures.
 */

const SIGNATURE_ENDPOINT = '/api/signature-image'
const CACHE_TTL_MS = 50 * 60 * 1000

const cache = new Map<string, { url: string; expiresAt: number }>()
const inFlight = new Map<string, Promise<string>>()

/**
 * Bumped every time the cache is cleared (user change / sign-out). A request that started
 * under an older generation must not write its result into the cache, and must not remove
 * a newer request's in-flight entry.
 */
let generation = 0

/** True when `src` must be fetched through the authenticated endpoint. */
export function isProtectedImageSrc(src: string | null | undefined): src is string {
  return typeof src === 'string' && src.startsWith(`${SIGNATURE_ENDPOINT}?`)
}

export async function resolveSecureImageUrl(src: string): Promise<string> {
  const hit = cache.get(src)
  if (hit && hit.expiresAt > Date.now()) return hit.url

  const pending = inFlight.get(src)
  if (pending) return pending

  const startedInGeneration = generation

  const promise: Promise<string> = (async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) throw new Error('Not signed in')

    const res = await fetch(src, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`Image request failed (${res.status})`)

    const body = (await res.json()) as { url?: string }
    if (!body.url) throw new Error('No image URL returned')

    // Only cache if the signed-in user has not changed since this request started.
    if (startedInGeneration === generation) {
      cache.set(src, { url: body.url, expiresAt: Date.now() + CACHE_TTL_MS })
    }
    return body.url
  })().finally(() => {
    // Only remove our own entry; after a clear, a newer request may own this key.
    if (inFlight.get(src) === promise) inFlight.delete(src)
  })

  inFlight.set(src, promise)
  return promise
}

/** Drops every cached URL so one user's signed URLs are never reused by the next. */
export function clearSecureImageCache(): void {
  generation += 1
  cache.clear()
  inFlight.clear()
}

// Clear the cache whenever the signed-in user changes or signs out
// (covers "Switch user" and logout on a shared tab).
if (typeof window !== 'undefined') {
  let lastUserId: string | null | undefined
  supabase.auth.onAuthStateChange((_event, session) => {
    const userId = session?.user?.id ?? null
    if (lastUserId !== undefined && userId !== lastUserId) clearSecureImageCache()
    lastUserId = userId
  })
}
