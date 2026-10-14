import { IMAGE_TYPES, MAX_IMAGE_CHARS, fitWithin } from '@/features/planner/appearance'

export type ImageError = 'unsupported_type' | 'too_large' | 'decode_failed' | 'still_too_big'

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const LONG_SIDE = [1600, 1280, 960]
const QUALITY = [0.8, 0.7, 0.6]

/**
 * Turns an uploaded photo into a small JPEG data URL that fits the stored limit: downscaled to at
 * most 1600 px (smaller if needed) and re-encoded. Aspect ratio is preserved.
 */
export async function processImage(
  file: File,
): Promise<{ ok: true; image: string } | { ok: false; error: ImageError }> {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type))
    return { ok: false, error: 'unsupported_type' }
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: 'too_large' }
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return { ok: false, error: 'decode_failed' }
  }
  try {
    for (const [i, max] of LONG_SIDE.entries()) {
      const { width, height } = fitWithin(bitmap.width, bitmap.height, max)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) return { ok: false, error: 'decode_failed' }
      // JPEG has no alpha: paint white first so transparent PNGs do not turn black.
      context.fillStyle = '#fff'
      context.fillRect(0, 0, width, height)
      context.drawImage(bitmap, 0, 0, width, height)
      const image = canvas.toDataURL('image/jpeg', QUALITY[i])
      if (image.length <= MAX_IMAGE_CHARS) return { ok: true, image }
    }
    return { ok: false, error: 'still_too_big' }
  } finally {
    bitmap.close()
  }
}
