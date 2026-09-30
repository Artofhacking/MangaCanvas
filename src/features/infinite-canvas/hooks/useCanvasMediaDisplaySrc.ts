import { useSyncExternalStore } from 'react'
import { useStore } from 'reactflow'
import { mediaUrl } from '@/lib/mediaUrl'
import {
  CANVAS_IMAGE_MIN_VISIBLE_RATIO,
  allowsCanvasFullResolution,
  canDownscaleCanvasImageUrl,
  getCanvasOverviewZoom,
  resolveCanvasImageDisplay,
  subscribeCanvasOverviewZoom,
} from '../utils/canvasMediaBudget'
import { useCanvasDisplayObjectUrl } from './useCanvasDisplayObjectUrl'
import { useCanvasDisplaySlot, useCanvasFullResSlot, useCanvasPreviewSlot } from './useCanvasFullResSlot'
import { useCanvasNodeInViewport } from './useCanvasNodeInViewport'
import { useCanvasViewportSettled } from './useCanvasViewportSettled'

/**
 * `<img src>` for a canvas card.
 * The original asset URL stays on lightbox, download, and save-to-library.
 */
export function useCanvasMediaDisplaySrc(input: {
  nodeId: string
  /** Box used for viewport and measurement. Stacked candidates share the parent node. */
  layoutNodeId?: string
  url?: string | null
  thumbnail?: string | null
}): string {
  const layoutNodeId = input.layoutNodeId || input.nodeId
  const viewportSettled = useCanvasViewportSettled()
  const zoom = useStore((state) => state.transform[2])
  const overviewZoom = useSyncExternalStore(subscribeCanvasOverviewZoom, getCanvasOverviewZoom, () => null)
  const allowFullResolution = allowsCanvasFullResolution(zoom, overviewZoom)
  const measured = useStore((state) => {
    const node = state.nodeInternals.get(layoutNodeId)
    const width = node?.width
    const height = node?.height
    return typeof width === 'number' && width > 0 && typeof height === 'number' && height > 0
  })
  const inViewport = useCanvasNodeInViewport(layoutNodeId, CANVAS_IMAGE_MIN_VISIBLE_RATIO)
  const full = mediaUrl((input.url || '').trim())
  const thumb = mediaUrl((input.thumbnail || '').trim())
  const distinctThumb = Boolean(thumb && thumb !== full)
  const eligible = viewportSettled && measured && inViewport
  const wantsFull = eligible && !distinctThumb && Boolean(full) && allowFullResolution
  const fullResGranted = useCanvasFullResSlot(`${input.nodeId}:full`, wantsFull)
  const wantsDisplay = eligible && !distinctThumb && !(wantsFull && fullResGranted) && canDownscaleCanvasImageUrl(full)
  const displayGranted = useCanvasDisplaySlot(`${input.nodeId}:display`, wantsDisplay)
  const wantsPreview = eligible && distinctThumb
  const previewGranted = useCanvasPreviewSlot(`${input.nodeId}:preview`, wantsPreview)
  const plan = resolveCanvasImageDisplay({
    url: full,
    thumbnail: thumb,
    inViewport,
    measured,
    viewportSettled,
    allowFullResolution: wantsFull,
    fullResGranted,
    previewGranted,
    displayGranted,
  })
  const objectUrl = useCanvasDisplayObjectUrl(plan.mode === 'downscale' ? plan.downscaleUrl : '')
  if (plan.mode === 'downscale') return objectUrl
  return plan.src
}
