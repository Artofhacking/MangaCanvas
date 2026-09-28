import { useRef } from 'react'
import { useStore } from 'reactflow'
import { Image as ImageIcon } from 'lucide-react'
import { mediaUrl } from '@/lib/mediaUrl'
import { isMediaPreviewDoubleClick } from '../../utils/canvasInteraction'
import { useCanvasFullResSlot } from '../../hooks/useCanvasFullResSlot'
import { useCanvasNodeInViewport } from '../../hooks/useCanvasNodeInViewport'
import {
  CANVAS_FULL_RES_MIN_ZOOM,
  CANVAS_IMAGE_MIN_VISIBLE_RATIO,
  resolveCanvasImageDisplaySrc,
} from '../../utils/canvasMediaBudget'

interface CanvasImagePreviewProps {
  nodeId: string
  url?: string | null
  thumbnail?: string | null
  alt?: string
  onOpenPreview: () => void
}

export function CanvasImagePreview({
  nodeId,
  url,
  thumbnail,
  alt,
  onOpenPreview,
}: CanvasImagePreviewProps) {
  const allowFullResolution = useStore((state) => state.transform[2] >= CANVAS_FULL_RES_MIN_ZOOM)
  const inViewport = useCanvasNodeInViewport(nodeId, CANVAS_IMAGE_MIN_VISIBLE_RATIO)
  const full = (url || '').trim()
  const thumb = (thumbnail || '').trim()
  const wantsFullResolution = Boolean(full) && inViewport && allowFullResolution && !(thumb && thumb !== full)
  const fullResGranted = useCanvasFullResSlot(nodeId, wantsFullResolution)
  const lastPreviewClickAt = useRef(0)

  const displaySrc = resolveCanvasImageDisplaySrc({
    url,
    thumbnail,
    inViewport,
    allowFullResolution,
    fullResGranted,
  })

  return (
    <div className="relative h-full w-full">
      {displaySrc ? (
        <img
          src={mediaUrl(displaySrc)}
          alt={alt || ''}
          draggable={false}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onDragStart={(event) => event.preventDefault()}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-[hsl(var(--media-stage-muted))]"
          aria-label={alt || '图片'}
        >
          <ImageIcon className="h-8 w-8" aria-hidden />
        </div>
      )}
      <div
        className="absolute inset-0"
        onClick={(event) => {
          const now = Date.now()
          if (!isMediaPreviewDoubleClick(now, lastPreviewClickAt.current)) {
            lastPreviewClickAt.current = now
            return
          }
          event.stopPropagation()
          event.preventDefault()
          lastPreviewClickAt.current = 0
          onOpenPreview()
        }}
      />
    </div>
  )
}
