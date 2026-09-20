/**
 * Canonical aspect-ratio helpers.
 *
 * Size keys are parsed (`1024x1536`, `1280*720`, …) and reduced by GCD.
 * Vendor sizes that are *almost* a named cinematic ratio (e.g. 1696×960 ≈ 16:9)
 * snap to that name; exact reduced ratios such as 2:3 are never remapped to 3:4.
 */

const CONVENTIONAL_RATIO: Record<string, string> = {
  '7:3': '21:9',
  '3:7': '9:21',
}

const NAMED_RATIO_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [16, 9],
  [9, 16],
  [4, 3],
  [3, 4],
  [3, 2],
  [2, 3],
  [21, 9],
  [9, 21],
]

/** Snap only when the reduced pair is an ungainly vendor size (e.g. 53:30). */
const SIMPLE_RATIO_MAX = 21
const SNAP_RELATIVE_TOLERANCE = 0.02

export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a))
  let y = Math.abs(Math.round(b))
  while (y !== 0) {
    const next = x % y
    x = y
    y = next
  }
  return x || 1
}

export function parseSizeDimensions(size: string): { width: number; height: number } | null {
  const match = String(size || '')
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*[xX×*]\s*(\d+(?:\.\d+)?)$/)
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }
  return { width, height }
}

function formatReducedRatio(width: number, height: number): string {
  const divisor = gcd(width, height)
  const rw = width / divisor
  const rh = height / divisor
  const reduced = `${rw}:${rh}`
  return CONVENTIONAL_RATIO[reduced] || reduced
}

function snapNamedRatio(width: number, height: number): string | null {
  const value = width / height
  let bestLabel: string | null = null
  let bestErr = Infinity
  for (const [w, h] of NAMED_RATIO_PAIRS) {
    const err = Math.abs(value - w / h) / (w / h)
    if (err < bestErr) {
      bestErr = err
      bestLabel = `${w}:${h}`
    }
  }
  return bestLabel && bestErr <= SNAP_RELATIVE_TOLERANCE ? bestLabel : null
}

export function getSizeRatio(size: string, fallback = '1:1'): string {
  const dims = parseSizeDimensions(size)
  if (!dims) return fallback
  const width = Math.round(dims.width)
  const height = Math.round(dims.height)
  const reduced = formatReducedRatio(width, height)
  const [rw, rh] = reduced.split(':').map(Number)
  if (rw <= SIMPLE_RATIO_MAX && rh <= SIMPLE_RATIO_MAX) return reduced
  return snapNamedRatio(width, height) || reduced
}

export function aspectValue(ratio: string): number {
  const parts = String(ratio || '').split(/[:/]/).map((part) => Number(part.trim()))
  const width = parts[0] && parts[0] > 0 ? parts[0] : 1
  const height = parts[1] && parts[1] > 0 ? parts[1] : 1
  return width / height
}

/** Landscape (wider) first, then square, then portrait. */
export function sortAspectRatios(ratios: readonly string[]): string[] {
  return [...new Set(ratios)].sort((a, b) => aspectValue(b) - aspectValue(a))
}

export function uniqueAspectRatios(sizes: readonly { key: string }[]): string[] {
  const ratios: string[] = []
  const seen = new Set<string>()
  for (const size of sizes) {
    const ratio = getSizeRatio(size.key)
    if (seen.has(ratio)) continue
    seen.add(ratio)
    ratios.push(ratio)
  }
  return sortAspectRatios(ratios)
}

export function sizeOptionFromKey(key: string): { key: string; label: string } {
  return { key, label: `${getSizeRatio(key)} (${key})` }
}

export function labeledSizes(keys: readonly string[]): { key: string; label: string }[] {
  return keys.map(sizeOptionFromKey)
}

export function nodeAspectRatio(
  data: { ratio?: unknown; size?: unknown },
  fallback?: string
): string | undefined {
  if (typeof data.ratio === 'string' && data.ratio) return data.ratio
  if (typeof data.size === 'string' && data.size) return getSizeRatio(data.size, fallback)
  return fallback
}

export function aspectRatioIconSize(ratio: string, max = 16): { w: number; h: number } {
  const parts = String(ratio || '').split(':').map((part) => Number(part.trim()))
  const width = parts[0] && parts[0] > 0 ? parts[0] : 1
  const height = parts[1] && parts[1] > 0 ? parts[1] : 1
  if (width === height) return { w: 12, h: 12 }
  if (width > height) {
    return { w: max, h: Math.max(6, Math.round((max * height) / width)) }
  }
  return { w: Math.max(6, Math.round((max * width) / height)), h: max }
}
