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
  setCanvasVideoIntent,
  subscribeActiveCanvasVideo,
} from '../../utils/canvasMediaBudget'
import { useCanvasMediaDisplaySrc } from '../../hooks/useCanvasMediaDisplaySrc'
import {
  canvasVideoSeekBarInsets,
  canvasVideoUsesNativeControls,
  shouldShowCanvasVideoSeekBar,
} from '../../utils/canvasVideoSeek'
import { canvasVideoPreviewMediaClass, canvasVideoPreviewStageClass } from './canvasVideoPreview'
import { CanvasVideoSeekBar } from './CanvasVideoSeekBar'

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
  /** Keep the track off the mute chip and, on a stack, off the corner fan. */
  seekBarInsets?: { left: number; right: number }
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
  seekBarInsets = canvasVideoSeekBarInsets({ stacked: false, fanWidth: 0 }),
}: CanvasVideoPreviewProps) {
  const measuredInViewport = useCanvasNodeInViewport(nodeId, CANVAS_VIDEO_MIN_VISIBLE_RATIO)
  const inViewport = measuredInViewport && !suspended
  const [hovered, setHovered] = useState(false)
  const [hoverCommitted, setHoverCommitted] = useState(false)
  const [playRequested, setPlayRequested] = useState(false)
  const explicitSeqRef = useRef(0)
  const gestureWasOnRef = useRef(false)
  const lastPreviewClickAt = useRef(0)
  const stageRef = useRef<HTMLDivElement>(null)
  const scrubbingRef = useRef(false)
  const activeId = useSyncExternalStore(subscribeActiveCanvasVideo, getActiveCanvasVideoId, () => null)
  const showVideo = shouldShowCanvasVideoSeekBar({
    hasPlayableUrl: Boolean(url),
    suspended: Boolean(suspended),
    inViewport: measuredInViewport,
    ownsDecoder: activeId === nodeId,
  })
  const poster = useCanvasMediaDisplaySrc({
    nodeId,
    url: null,
    thumbnail: suspended ? null : thumbnail,
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
      ref={stageRef}
      className={canvasVideoPreviewStageClass}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        if (scrubbingRef.current) return
        setHovered(false)
      }}
    >
      {showVideo ? (
        <video
          ref={videoRef}
          src={mediaUrl(url)}
          controls={canvasVideoUsesNativeControls}
          autoPlay={playback.autoPlay}
          loop={playback.loop}
          muted={playback.muted}
          playsInline={playback.playsInline}
          poster={poster ? mediaUrl(poster) : undefined}
          draggable={false}
          className={canvasVideoPreviewMediaClass}
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
          fetchPriority="low"
          className={canvasVideoPreviewMediaClass}
          onDragStart={(event) => event.preventDefault()}
        />
      ) : null}
      <div
        className="absolute inset-0 z-0"
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
      {showVideo ? (
        <CanvasVideoSeekBar
          videoRef={videoRef}
          src={url || ''}
          insets={seekBarInsets}
          onScrubbingChange={(scrubbing) => {
            scrubbingRef.current = scrubbing
            if (scrubbing) return
            const stage = stageRef.current
            if (stage && !stage.matches(':hover')) setHovered(false)
          }}
        />
      ) : null}
    </div>
  )
}
