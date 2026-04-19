/**
 * Resize and re-encode an image file to a data URL for storage on `patients.patient_photo`.
 * Runs in the browser only.
 */
export async function compressImageFileToDataUrl(
  file: File,
  options?: { maxEdge?: number; quality?: number }
): Promise<string> {
  const maxEdge = options?.maxEdge ?? 1024
  const quality = options?.quality ?? 0.82
  if (typeof createImageBitmap !== 'function') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }
  const bitmap = await createImageBitmap(file)
  try {
    let { width, height } = bitmap
    const scale = Math.min(1, maxEdge / Math.max(width, height, 1))
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not supported')
    ctx.drawImage(bitmap, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    bitmap.close()
  }
}
