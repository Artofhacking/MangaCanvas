import { useCallback, type MouseEvent, type RefObject } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { mediaUrl } from '@/lib/mediaUrl'
import { useCanvasStore } from '../../stores/canvasStore'
import { useCanvasMediaDisplaySrc } from '../../hooks/useCanvasMediaDisplaySrc'
import {
  IMAGE_STACK_CARD,
  IMAGE_STACK_STEP_X,
  IMAGE_STACK_STEP_Y,
  placeStackCandidates,
} from '../../utils/imageStack'
import { canvasVideoSeekBarInsets } from '../../utils/canvasVideoSeek'
import { readVideoStack, videoStackActivationPatch } from '../../utils/videoStack'
import { CanvasVideoPreview } from './CanvasVideoPreview'

interface VideoStackPreviewProps {
  nodeId: string
  urls: string[]
  thumbnails: string[]
  activeIndex: number
  thumbnail?: string | null
  selected?: boolean
  muted: boolean
  suspended?: boolean
  videoRef: RefObject<HTMLVideoElement>
  onOpenPreview: () => void
  onActivate: (index: number) => void
}

/**
 * One video fills the stage the same way a single result does.
 * Extra results sit in a corner fan of stills; clicking one makes it the front clip.
 */
export function VideoStackPreview({
  nodeId,
  urls,
  thumbnails,
  activeIndex,
  thumbnail,
  selected,
  muted,
  suspended,
  videoRef,
  onOpenPreview,
  onActivate,
}: VideoStackPreviewProps) {
  const safeIndex = activeIndex >= 0 && activeIndex < urls.length ? activeIndex : 0
  const front = urls[safeIndex] || urls[0] || ''
  const frontThumb = thumbnails[safeIndex] || thumbnail || ''

  if (urls.length <= 1) {
    return (
      <CanvasVideoPreview
        nodeId={nodeId}
        url={front}
        thumbnail={frontThumb}
        selected={selected}
        muted={muted}
        suspended={suspended}
        videoRef={videoRef}
        onOpenPreview={onOpenPreview}
        seekBarInsets={canvasVideoSeekBarInsets({ stacked: false, fanWidth: 0 })}
      />
    )
  }

  const placements = placeStackCandidates(urls.length, safeIndex)
  const fanWidth = IMAGE_STACK_CARD + Math.max(0, placements.length - 1) * IMAGE_STACK_STEP_X
  const fanHeight = IMAGE_STACK_CARD + Math.max(0, placements.length - 1) * IMAGE_STACK_STEP_Y

  return (
    <div className="relative h-full w-full">
      <CanvasVideoPreview
        nodeId={nodeId}
        url={front}
        thumbnail={frontThumb}
        selected={selected}
        muted={muted}
        suspended={suspended}
        videoRef={videoRef}
        onOpenPreview={onOpenPreview}
        seekBarInsets={canvasVideoSeekBarInsets({ stacked: true, fanWidth })}
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
            thumbnail={thumbnails[placement.index] || ''}
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
  thumbnail,
  right,
  bottom,
  zIndex,
  rotate,
  onActivate,
}: {
  nodeId: string
  index: number
  thumbnail: string
  right: number
  bottom: number
  zIndex: number
  rotate: number
  onActivate: () => void
}) {
  const displaySrc = useCanvasMediaDisplaySrc({
    nodeId: `${nodeId}:vstack:${index}`,
    layoutNodeId: nodeId,
    url: thumbnail || null,
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
      aria-label={`第${index + 1}条，点击置顶`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
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

interface VideoResultStageProps {
  nodeId: string
  data: {
    url?: unknown
    videoUrls?: unknown
    thumbnailUrls?: unknown
    thumbnail?: unknown
    activeVideoIndex?: unknown
  }
  selected?: boolean
  muted: boolean
  suspended?: boolean
  videoRef: RefObject<HTMLVideoElement>
  onOpenPreview: () => void
  onToggleMute: (event: MouseEvent) => void
}

/** Front clip plus the corner fan. The mute control moves left when the fan occupies the corner. */
export function VideoResultStage({
  nodeId,
  data,
  selected,
  muted,
  suspended,
  videoRef,
  onOpenPreview,
  onToggleMute,
}: VideoResultStageProps) {
  const updateNode = useCanvasStore((state) => state.updateNode)
  const stack = readVideoStack(data)
  const stacked = stack.urls.length > 1

  const activate = useCallback((index: number) => {
    const current = useCanvasStore.getState().nodes.find((node) => node.id === nodeId)
    if (!current) return
    const patch = videoStackActivationPatch(current.data, index)
    if (!patch) return
    updateNode(nodeId, patch)
  }, [nodeId, updateNode])

  return (
    <div className="relative h-full w-full">
      <VideoStackPreview
        nodeId={nodeId}
        urls={stack.urls}
        thumbnails={stack.thumbnails}
        activeIndex={stack.activeIndex}
        thumbnail={typeof data.thumbnail === 'string' ? data.thumbnail : undefined}
        selected={selected}
        muted={muted}
        suspended={suspended}
        videoRef={videoRef}
        onOpenPreview={onOpenPreview}
        onActivate={activate}
      />
      <button
        type="button"
        onClick={onToggleMute}
        className={
          stacked
            ? 'nodrag nopan absolute bottom-2.5 left-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white/90 backdrop-blur-sm'
            : 'nodrag nopan absolute bottom-2.5 right-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white/90 backdrop-blur-sm'
        }
        title={muted ? '打开声音' : '静音'}
      >
        {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}
