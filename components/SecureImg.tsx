import React, { useEffect, useState } from 'react'
import { isProtectedImageSrc, resolveSecureImageUrl } from '../lib/secureImageUrl'

/** 1x1 transparent GIF shown while the signed URL is being fetched. */
const PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/** Deliberately undecodable image: forces the browser to fire the normal `onError`. */
const FAILED = 'data:image/png;base64,'

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string
}

/**
 * Drop-in replacement for <img> for signature / initials images.
 *
 * - `/api/signature-image?...` sources are fetched with the user's access token,
 *   then loaded from the returned short-lived signed URL.
 * - Any other source (e.g. a legacy `data:image/...`) passes straight through.
 * - Always renders exactly one <img> in the same place, and forwards `onError`,
 *   so existing "hide image, show sibling fallback" handlers keep working.
 *   A failed lookup (not signed in, not allowed, network) triggers `onError`.
 */
export default function SecureImg({ src, ...rest }: Props) {
  const protectedSrc = isProtectedImageSrc(src)
  const [resolved, setResolved] = useState<string>(protectedSrc ? PLACEHOLDER : src)

  useEffect(() => {
    if (!isProtectedImageSrc(src)) {
      setResolved(src)
      return
    }
    let cancelled = false
    setResolved(PLACEHOLDER)
    resolveSecureImageUrl(src)
      .then((url) => {
        if (!cancelled) setResolved(url)
      })
      .catch(() => {
        if (!cancelled) setResolved(FAILED)
      })
    return () => {
      cancelled = true
    }
  }, [src])

  // eslint-disable-next-line @next/next/no-img-element
  // referrerPolicy default: never leak the page URL (may contain patient/record IDs) to S3.
  return <img referrerPolicy="no-referrer" {...rest} src={protectedSrc ? resolved : src} />
}
