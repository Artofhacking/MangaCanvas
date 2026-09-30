import { useRef } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { mediaUrl } from '@/lib/mediaUrl'
import { isMediaPreviewDoubleClick } from '../../utils/canvasInteraction'
import { useCanvasMediaDisplaySrc } from '../../hooks/useCanvasMediaDisplaySrc'
import { canvasImagePreviewMediaClass } from './canvasImagePreview'

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
  const lastPreviewClickAt = useRef(0)
  // Card chrome only. Preview modal, download, and save-to-library keep `url`.
  const displaySrc = useCanvasMediaDisplaySrc({ nodeId, url, thumbnail })

  return (
    <div className="relative h-full w-full">
      {displaySrc ? (
        <img
          src={mediaUrl(displaySrc)}
          alt={alt || ''}
          draggable={false}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          className={canvasImagePreviewMediaClass}
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
