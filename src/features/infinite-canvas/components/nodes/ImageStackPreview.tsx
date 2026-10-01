import { mediaUrl } from '@/lib/mediaUrl'
import { isReferencePickActive } from '../../utils/referencePick'
import { useCanvasMediaDisplaySrc } from '../../hooks/useCanvasMediaDisplaySrc'
import {
  IMAGE_STACK_CARD,
  IMAGE_STACK_STEP_X,
  IMAGE_STACK_STEP_Y,
  placeStackCandidates,
} from '../../utils/imageStack'
import type { MediaMeasurement } from '../../utils/mediaFrame'
import { CanvasImagePreview } from './CanvasImagePreview'

interface ImageStackPreviewProps {
  nodeId: string
  urls: string[]
  activeIndex: number
  thumbnail?: string | null
  alt?: string
  onOpenPreview: () => void
  onMeasured?: (measurement: MediaMeasurement) => void
  onActivate: (index: number) => void
}

/**
 * One image fills the stage the same way a single result does.
 * Extra results sit in a corner fan; clicking one makes it the front image.
 */
export function ImageStackPreview({
  nodeId,
  urls,
  activeIndex,
  thumbnail,
  alt,
  onOpenPreview,
  onMeasured,
  onActivate,
}: ImageStackPreviewProps) {
  const safeIndex = activeIndex >= 0 && activeIndex < urls.length ? activeIndex : 0
  const front = urls[safeIndex] || urls[0] || ''

  if (urls.length <= 1) {
    return (
      <CanvasImagePreview
        nodeId={nodeId}
        url={front}
        thumbnail={thumbnail}
        alt={alt}
        onOpenPreview={onOpenPreview}
        onMeasured={onMeasured}
      />
    )
  }

  const placements = placeStackCandidates(urls.length, safeIndex)
  const fanWidth = IMAGE_STACK_CARD + Math.max(0, placements.length - 1) * IMAGE_STACK_STEP_X
  const fanHeight = IMAGE_STACK_CARD + Math.max(0, placements.length - 1) * IMAGE_STACK_STEP_Y
  const frontThumb = thumbnail && thumbnail === front ? thumbnail : undefined

  return (
    <div className="relative h-full w-full">
      <CanvasImagePreview
        nodeId={nodeId}
        url={front}
        thumbnail={frontThumb}
        alt={alt}
        onOpenPreview={onOpenPreview}
        onMeasured={onMeasured}
      />
      <div
        className="pointer-events-none absolute left-2.5 top-2.5 z-20 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white"
        aria-hidden
      >
        {safeIndex + 1}/{urls.length}
      </div>
      <div
        className="pointer-events-none absolute bottom-3 right-3 z-20"
        style={{ width: fanWidth, height: fanHeight }}
      >
        {placements.map((placement) => (
          <StackCandidate
            key={`${placement.index}:${urls[placement.index]}`}
            nodeId={nodeId}
            index={placement.index}
            url={urls[placement.index] || ''}
            right={placement.right}
            bottom={placement.bottom}
            zIndex={placement.zIndex}
            rotate={placement.rotate}
            onActivate={() => onActivate(placement.index)}
          />
        ))}
      </div>
    </div>
  )
}

function StackCandidate({
  nodeId,
  index,
  url,
  right,
  bottom,
  zIndex,
  rotate,
  onActivate,
}: {
  nodeId: string
  index: number
  url: string
  right: number
  bottom: number
  zIndex: number
  rotate: number
  onActivate: () => void
}) {
  const displaySrc = useCanvasMediaDisplaySrc({
    nodeId: `${nodeId}:stack:${index}`,
    layoutNodeId: nodeId,
    url,
  })

  return (
    <button
      type="button"
      className="nodrag nopan nowheel pointer-events-auto absolute overflow-hidden rounded-2xl border-2 border-[hsl(var(--surface-container-lowest))] bg-[hsl(var(--media-stage))] shadow-[0_10px_24px_rgba(0,0,0,0.22)] hover:shadow-[0_14px_28px_rgba(0,0,0,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
      style={{
        width: IMAGE_STACK_CARD,
        height: IMAGE_STACK_CARD,
        right,
        bottom,
        zIndex,
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
      }}
      title="点击置顶"
      aria-label={`第${index + 1}张，点击置顶`}
      onPointerDown={(event) => {
        if (isReferencePickActive()) return
        event.stopPropagation()
      }}
      onClick={(event) => {
        if (isReferencePickActive()) return
        event.stopPropagation()
        event.preventDefault()
        onActivate()
      }}
    >
      {displaySrc ? (
        <img
          src={mediaUrl(displaySrc)}
          alt=""
          draggable={false}
          className="h-full w-full object-contain object-center"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[11px] font-medium text-[hsl(var(--media-stage-muted))]">
          {index + 1}
        </span>
      )}
    </button>
  )
}
