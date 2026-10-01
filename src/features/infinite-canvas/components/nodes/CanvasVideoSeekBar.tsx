import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import {
  canvasVideoSeekBarClass,
  formatCanvasVideoTime,
  readCanvasVideoClock,
  seekRatioFromPointer,
  seekTimeFromKeyboard,
  seekTimeFromRatio,
} from '../../utils/canvasVideoSeek'

interface CanvasVideoSeekBarProps {
  videoRef: RefObject<HTMLVideoElement>
  insets: { left: number; right: number }
  /** Keeps the inline decoder mounted while a drag leaves the card. */
  onScrubbingChange?: (scrubbing: boolean) => void
}

function blockCanvasGesture(event: { stopPropagation: () => void; preventDefault?: () => void }) {
  event.stopPropagation()
  event.preventDefault?.()
}

/**
 * Slim playback scrub for the inline canvas player.
 * The element is only mounted while this node owns the single decoder.
 */
export function CanvasVideoSeekBar({ videoRef, insets, onScrubbingChange }: CanvasVideoSeekBarProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const scrubbingRef = useRef(false)
  const onScrubbingChangeRef = useRef(onScrubbingChange)
  const [clock, setClock] = useState({ current: 0, duration: 0, ratio: 0 })
  onScrubbingChangeRef.current = onScrubbingChange

  useEffect(() => () => {
    if (!scrubbingRef.current) return
    scrubbingRef.current = false
    onScrubbingChangeRef.current?.(false)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const sync = () => {
      if (scrubbingRef.current) return
      setClock(readCanvasVideoClock(video.currentTime, video.duration))
    }

    sync()
    video.addEventListener('timeupdate', sync)
    video.addEventListener('loadedmetadata', sync)
    video.addEventListener('durationchange', sync)
    video.addEventListener('seeked', sync)
    video.addEventListener('emptied', sync)
    return () => {
      video.removeEventListener('timeupdate', sync)
      video.removeEventListener('loadedmetadata', sync)
      video.removeEventListener('durationchange', sync)
      video.removeEventListener('seeked', sync)
      video.removeEventListener('emptied', sync)
    }
  }, [videoRef])

  const commitSeek = (time: number | null) => {
    const video = videoRef.current
    if (!video || time == null || video.readyState < HTMLMediaElement.HAVE_METADATA) return
    try {
      video.currentTime = time
    } catch {
      return
    }
    setClock(readCanvasVideoClock(time, video.duration))
  }

  const seekToClientX = (clientX: number) => {
    const track = trackRef.current
    const video = videoRef.current
    if (!track || !video) return
    const rect = track.getBoundingClientRect()
    const ratio = seekRatioFromPointer(clientX, rect.left, rect.width)
    commitSeek(seekTimeFromRatio(ratio, video.duration))
  }

  const onTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    blockCanvasGesture(event)
    scrubbingRef.current = true
    onScrubbingChange?.(true)
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.focus()
    seekToClientX(event.clientX)
  }

  const onTrackPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!scrubbingRef.current) return
    event.stopPropagation()
    seekToClientX(event.clientX)
  }

  const endScrub = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!scrubbingRef.current) return
    scrubbingRef.current = false
    onScrubbingChange?.(false)
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    const video = videoRef.current
    if (video) setClock(readCanvasVideoClock(video.currentTime, video.duration))
  }

  const label = `${formatCanvasVideoTime(clock.current)} / ${formatCanvasVideoTime(clock.duration)}`

  return (
    <div
      className={canvasVideoSeekBarClass}
      style={{ left: insets.left, right: insets.right }}
      onPointerDown={blockCanvasGesture}
      onMouseDown={blockCanvasGesture}
      onClick={blockCanvasGesture}
      onDoubleClick={blockCanvasGesture}
    >
      <span className="shrink-0 text-[11px] font-medium tabular-nums leading-none text-white/95">
        {formatCanvasVideoTime(clock.current)}
      </span>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="播放进度"
        aria-valuemin={0}
        aria-valuemax={Math.round(clock.duration)}
        aria-valuenow={Math.round(clock.current)}
        aria-valuetext={label}
        className="relative h-6 min-w-[48px] flex-1 cursor-pointer touch-none select-none rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/80"
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          blockCanvasGesture(event)
          const video = videoRef.current
          if (!video) return
          commitSeek(
            seekTimeFromKeyboard(video.currentTime, video.duration, event.key === 'ArrowRight' ? 1 : -1),
          )
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-white/35">
          <div className="h-full rounded-full bg-white" style={{ width: `${clock.ratio * 100}%` }} />
        </div>
        <div
          className="pointer-events-none absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm"
          style={{ left: `${clock.ratio * 100}%` }}
        />
      </div>
      <span className="shrink-0 text-[11px] font-medium tabular-nums leading-none text-white/95">
        {formatCanvasVideoTime(clock.duration)}
      </span>
    </div>
  )
}
