/**
 * Converts a stored signature/initials value to a displayable image src.
 * Values can be:
 *   - `s3:signatures/userId/timestamp-type.jpg`  → S3-stored image (new)
 *   - `data:image/...`                            → legacy base64 (existing users)
 *   - anything else                               → text initials, not an image
 */
export function signatureToImgSrc(value: string | null | undefined): string | null {
  if (!value) return null
  if (value.startsWith('s3:')) {
    const key = value.slice(3)
    return `/api/signature-image?key=${encodeURIComponent(key)}`
  }
  if (value.startsWith('data:image')) return value
  return null
}

/** Returns true if the stored value represents a drawn image (S3 or base64). */
export function isSignatureImage(value: string | null | undefined): boolean {
  if (!value) return false
  return value.startsWith('s3:') || value.startsWith('data:image')
}
