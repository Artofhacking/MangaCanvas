import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { Play } from 'lucide-react'
import { mediaUrl } from '@/lib/mediaUrl'
import { isMediaPreviewDoubleClick } from '../../utils/canvasInteraction'
import { useCanvasNodeInViewport } from '../../hooks/useCanvasNodeInViewport'
import {
  CANVAS_VIDEO_HOVER_PLAY_MS,
  CANVAS_VIDEO_MIN_VISIBLE_RATIO,
  activeCanvasVideoProps,
  getActiveCanvasVideoId,
  nextCanvasVideoInteractionSeq,
  resolveCanvasImageDisplaySrc,
  setCanvasVideoIntent,
  subscribeActiveCanvasVideo,
} from '../../utils/canvasMediaBudget'

interface CanvasVideoPreviewProps {
  nodeId: string
  url?: string | null
  thumbnail?: string | null
  selected?: boolean
  muted: boolean
  /** Hide the decoder while the lightbox is open so two players do not run. */
  suspended?: boolean
  videoRef: RefObject<HTMLVideoElement>
  onOpenPreview: () => void
}

export function CanvasVideoPreview({
  nodeId,
  url,
  thumbnail,
  selected,
  muted,
  suspended,
  videoRef,
  onOpenPreview,
}: CanvasVideoPreviewProps) {
  const measuredInViewport = useCanvasNodeInViewport(nodeId, CANVAS_VIDEO_MIN_VISIBLE_RATIO)
  const inViewport = measuredInViewport && !suspended
  const [hovered, setHovered] = useState(false)
  const [hoverCommitted, setHoverCommitted] = useState(false)
  const [playRequested, setPlayRequested] = useState(false)
  const explicitSeqRef = useRef(0)
  const gestureWasOnRef = useRef(false)
  const lastPreviewClickAt = useRef(0)
  const activeId = useSyncExternalStore(subscribeActiveCanvasVideo, getActiveCanvasVideoId, () => null)
  const showVideo = activeId === nodeId && inViewport && Boolean(url)
  const poster = resolveCanvasImageDisplaySrc({
    url: null,
    thumbnail,
    inViewport,
    allowFullResolution: false,
    fullResGranted: false,
  })
  const playback = activeCanvasVideoProps(muted)
  const gestureOn = hoverCommitted || playRequested

  useEffect(() => {
    if (!hovered) {
      setHoverCommitted(false)
      return
    }
    const timer = window.setTimeout(() => setHoverCommitted(true), CANVAS_VIDEO_HOVER_PLAY_MS)
    return () => window.clearTimeout(timer)
  }, [hovered])

  useEffect(() => {
    if (gestureOn && !gestureWasOnRef.current) {
      explicitSeqRef.current = nextCanvasVideoInteractionSeq()
    }
    gestureWasOnRef.current = gestureOn
    setCanvasVideoIntent(nodeId, {
      inViewport,
      selected: Boolean(selected),
      hovered: hoverCommitted,
      playRequested,
      explicitSeq: explicitSeqRef.current,
    })
  }, [gestureOn, hoverCommitted, inViewport, nodeId, playRequested, selected])

  useEffect(() => () => setCanvasVideoIntent(nodeId, null), [nodeId])

  return (
    <div
      className="relative h-full w-full bg-black"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {showVideo ? (
        <video
          ref={videoRef}
          src={mediaUrl(url)}
          autoPlay={playback.autoPlay}
          loop={playback.loop}
          muted={playback.muted}
          playsInline={playback.playsInline}
          poster={poster ? mediaUrl(poster) : undefined}
          draggable={false}
          className="h-full w-full object-cover"
          onDragStart={(event) => event.preventDefault()}
          onCanPlay={(event) => {
            event.currentTarget.play().catch(() => {})
          }}
        />
      ) : poster ? (
        <img
          src={mediaUrl(poster)}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onDragStart={(event) => event.preventDefault()}
        />
      ) : null}
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
      {showVideo ? null : (
        <button
          type="button"
          className="nodrag nopan absolute left-1/2 top-1/2 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-sm"
          title="播放"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            event.preventDefault()
            const now = Date.now()
            if (isMediaPreviewDoubleClick(now, lastPreviewClickAt.current)) {
              lastPreviewClickAt.current = 0
              onOpenPreview()
              return
            }
            lastPreviewClickAt.current = now
            setPlayRequested(true)
          }}
        >
          <Play className="h-5 w-5 fill-current" />
        </button>
      )}
    </div>
  )
}
