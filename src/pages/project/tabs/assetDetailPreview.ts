import { getSizeRatio } from "@/features/infinite-canvas/utils/aspectRatio"

export function formatAssetAspectRatio(ratio?: string | null) {
  const value = ratio?.trim()
  return value ? value : "—"
}

/** Reduce a decoded bitmap size to a display ratio such as `3:4` or `16:9`. */
export function aspectRatioFromNaturalSize(width: number, height: number): string | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }
  return getSizeRatio(`${Math.round(width)}x${Math.round(height)}`)
}

/** Prefer the stored generation ratio, then the bitmap's real ratio. */
export function resolveDisplayedAspectRatio(stored?: string | null, natural?: string | null) {
  const storedValue = stored?.trim()
  if (storedValue) return storedValue
  return formatAssetAspectRatio(natural)
}

/** Large preview: contain the whole frame inside the pane. */
export const assetDetailPreviewMediaClass =
  "absolute inset-0 h-full w-full bg-black object-contain object-center"
