import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useCanvasStore } from '../stores/canvasStore'
import {
  readCanvasSourceSize,
  subscribeCanvasSourceSize,
} from '../utils/canvasDisplayBitmap'
import {
  formatMediaResolution,
  mediaPixelPatch,
  readExplicitMediaPixels,
  readSizePixels,
  type MediaMeasurement,
  type PixelSize,
} from '../utils/mediaFrame'

interface MediaFrameData {
  url?: unknown
  width?: unknown
  height?: unknown
  size?: unknown
  ratio?: unknown
}

function samePixels(left: PixelSize | null, right: PixelSize | null) {
  if (!left && !right) return true
  return Boolean(left && right && left.width === right.width && left.height === right.height)
}

/**
 * Aspect and `W×H` for a media card.
 * Explicit node pixels win. A downscale decode and the loaded bitmap fill in the rest.
 */
export function useMediaCardFrame(nodeId: string, data: MediaFrameData) {
  const updateNode = useCanvasStore((state) => state.updateNode)
  const sourceUrl = typeof data.url === 'string' ? data.url : ''
  const cached = useSyncExternalStore(
    subscribeCanvasSourceSize,
    () => readCanvasSourceSize(sourceUrl),
    () => null,
  )
  const [live, setLive] = useState<{ url: string; aspect: string | null; pixels: PixelSize | null } | null>(null)
  const liveMatch = live?.url === sourceUrl ? live : null

  const storedWidth = data.width
  const storedHeight = data.height

  useEffect(() => {
    if (!cached) return
    const patch = mediaPixelPatch({ width: storedWidth, height: storedHeight }, cached)
    if (patch) updateNode(nodeId, patch)
  }, [cached, nodeId, storedHeight, storedWidth, updateNode])

  const reportMeasurement = useCallback((measurement: MediaMeasurement) => {
    const nextPixels = measurement.pixels && measurement.pixels.width > 0 && measurement.pixels.height > 0
      ? { width: Math.round(measurement.pixels.width), height: Math.round(measurement.pixels.height) }
      : null
    setLive((current) => {
      const previous = current?.url === sourceUrl ? current : null
      const aspect = measurement.aspect || previous?.aspect || null
      const pixels = nextPixels || previous?.pixels || null
      if (previous && previous.aspect === aspect && samePixels(previous.pixels, pixels)) return current
      return { url: sourceUrl, aspect, pixels }
    })
    if (!nextPixels) return
    const patch = mediaPixelPatch({ width: storedWidth, height: storedHeight }, nextPixels)
    if (patch) updateNode(nodeId, patch)
  }, [nodeId, sourceUrl, storedHeight, storedWidth, updateNode])

  const explicit = readExplicitMediaPixels(data)
  const sizePixels = readSizePixels(data.size)
  const pixels = explicit || cached || liveMatch?.pixels || sizePixels
  const ratio = typeof data.ratio === 'string' ? data.ratio.trim() : ''
  const aspect = explicit
    ? `${explicit.width} / ${explicit.height}`
    : cached
      ? `${cached.width} / ${cached.height}`
      : liveMatch?.aspect
        || (sizePixels ? `${sizePixels.width} / ${sizePixels.height}` : '')
        || ratio
        || undefined

  return {
    aspect,
    resolution: pixels ? formatMediaResolution(pixels.width, pixels.height) : undefined,
    reportMeasurement,
  }
}
