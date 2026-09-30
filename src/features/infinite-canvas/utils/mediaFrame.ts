/**
 * Card frame for canvas image / video nodes.
 * Pixel size wins over a named ratio so the fixed-width card matches the bitmap
 * and object-contain does not letterbox or crop.
 */

import { mediaUrl } from '@/lib/mediaUrl'
import { parseSizeDimensions } from './aspectRatio'

export interface PixelSize {
  width: number
  height: number
}

export interface MediaMeasurement {
  aspect: string
  pixels?: PixelSize | null
}

function positiveInt(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  if (!Number.isFinite(number) || number <= 0) return null
  return Math.round(number)
}

export function readExplicitMediaPixels(data: { width?: unknown; height?: unknown } | null | undefined): PixelSize | null {
  if (!data) return null
  const width = positiveInt(data.width)
  const height = positiveInt(data.height)
  if (!width || !height) return null
  return { width, height }
}

export function readSizePixels(size: unknown): PixelSize | null {
  if (typeof size !== 'string') return null
  const parsed = parseSizeDimensions(size)
  if (!parsed) return null
  const width = Math.round(parsed.width)
  const height = Math.round(parsed.height)
  if (!(width > 0) || !(height > 0)) return null
  return { width, height }
}

/** Stored pixels, then a `1024x1536` size key. Named ratios are not pixel sizes. */
export function readStoredMediaPixels(data: {
  width?: unknown
  height?: unknown
  size?: unknown
} | null | undefined): PixelSize | null {
  if (!data) return null
  return readExplicitMediaPixels(data) || readSizePixels(data.size)
}

export function formatMediaResolution(width: number, height: number): string {
  return `${Math.round(width)}×${Math.round(height)}`
}

export function mediaResolutionLabel(data: {
  width?: unknown
  height?: unknown
  size?: unknown
} | null | undefined): string | undefined {
  const pixels = readStoredMediaPixels(data)
  if (!pixels) return undefined
  return formatMediaResolution(pixels.width, pixels.height)
}

/**
 * CSS aspect for the preview card.
 * Exact width/height beat `size`, which beats a named `ratio` such as 16:9.
 */
export function mediaFrameCssAspect(data: {
  width?: unknown
  height?: unknown
  size?: unknown
  ratio?: unknown
} | null | undefined): string | undefined {
  if (!data) return undefined
  const explicit = readExplicitMediaPixels(data)
  if (explicit) return `${explicit.width} / ${explicit.height}`
  const fromSize = readSizePixels(data.size)
  if (fromSize) return `${fromSize.width} / ${fromSize.height}`
  if (typeof data.ratio === 'string' && data.ratio.trim()) return data.ratio.trim()
  return undefined
}

/** Null when the node already stores this pixel size, so measurement does not loop. */
export function mediaPixelPatch(
  current: { width?: unknown; height?: unknown } | null | undefined,
  next: PixelSize | null | undefined,
): { width: number; height: number } | null {
  if (!next) return null
  const width = positiveInt(next.width)
  const height = positiveInt(next.height)
  if (!width || !height) return null
  const existing = readExplicitMediaPixels(current)
  if (existing && existing.width === width && existing.height === height) return null
  return { width, height }
}

/** Fields to write when the asset is replaced. Missing pixels clear a stale measurement. */
export function nextMediaPixelFields(pixels: PixelSize | null | undefined): { width?: number; height?: number } {
  const patch = mediaPixelPatch(null, pixels)
  if (!patch) return { width: undefined, height: undefined }
  return patch
}

function sameMediaResource(left: string, right: string): boolean {
  if (!left || !right) return false
  if (left === right) return true
  const normalizedLeft = mediaUrl(left)
  const normalizedRight = mediaUrl(right)
  return Boolean(normalizedLeft) && normalizedLeft === normalizedRight
}

/**
 * Aspect always comes from the decoded bitmap (a downscale keeps the ratio).
 * Pixel resolution is only the original size: a blob preview must not be labeled 256×144.
 */
export function measurePreviewImage(input: {
  displaySrc: string
  originalUrl: string
  naturalWidth: number
  naturalHeight: number
  cachedSource?: PixelSize | null
}): MediaMeasurement | null {
  const naturalWidth = positiveInt(input.naturalWidth)
  const naturalHeight = positiveInt(input.naturalHeight)
  const cachedWidth = positiveInt(input.cachedSource?.width)
  const cachedHeight = positiveInt(input.cachedSource?.height)
  const cached = cachedWidth && cachedHeight ? { width: cachedWidth, height: cachedHeight } : null
  if (!cached && (!naturalWidth || !naturalHeight)) return null

  const displaySrc = input.displaySrc.trim()
  const originalUrl = input.originalUrl.trim()
  const showsOriginal = Boolean(
    displaySrc &&
    !displaySrc.startsWith('blob:') &&
    !displaySrc.startsWith('data:') &&
    sameMediaResource(displaySrc, originalUrl),
  )
  const pixels = cached || (showsOriginal && naturalWidth && naturalHeight
    ? { width: naturalWidth, height: naturalHeight }
    : null)
  const aspectSource = pixels || (naturalWidth && naturalHeight ? { width: naturalWidth, height: naturalHeight } : null)
  if (!aspectSource) return null
  return {
    aspect: `${aspectSource.width} / ${aspectSource.height}`,
    pixels,
  }
}

export async function readBlobPixelSize(blob: Blob): Promise<PixelSize | null> {
  if (typeof createImageBitmap !== 'function') return null
  try {
    const bitmap = await createImageBitmap(blob)
    try {
      const width = positiveInt(bitmap.width)
      const height = positiveInt(bitmap.height)
      if (!width || !height) return null
      return { width, height }
    } finally {
      bitmap.close()
    }
  } catch {
    return null
  }
}
