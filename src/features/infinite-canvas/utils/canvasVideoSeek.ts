/** Inline canvas video stays control-less. Scrubbing is the custom bar. */
export const canvasVideoUsesNativeControls = false

/**
 * Overlay chrome. `nodrag` / `nopan` / `nowheel` keep a scrub from dragging
 * the node or panning the canvas. `absolute` so the card frame does not reflow.
 */
export const canvasVideoSeekBarClass =
  'nodrag nopan nowheel absolute bottom-1.5 z-[6] flex h-7 items-center gap-1.5 rounded-full bg-black/50 px-2 text-white shadow-sm backdrop-blur-sm'

/** Mute chip is 28px with a 10px corner inset. Keep the track off that corner. */
export const CANVAS_VIDEO_SEEK_MUTE_INSET = 46

/** Stack fan container uses `right-3` (12px). */
export const CANVAS_VIDEO_SEEK_FAN_EDGE = 12

export const CANVAS_VIDEO_SEEK_FAN_GAP = 8

/** Arrow-key step while the track is focused. Short clips stay easy to nudge. */
export const CANVAS_VIDEO_SEEK_KEY_STEP_SEC = 1

export function clampSeekRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0
  return Math.min(1, Math.max(0, ratio))
}

export function formatCanvasVideoTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const ss = String(secs).padStart(2, '0')
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`
  return `${minutes}:${ss}`
}

/** Pointer x on the track, as a 0–1 ratio. A zero-width track stays at the start. */
export function seekRatioFromPointer(clientX: number, left: number, width: number): number {
  if (!Number.isFinite(clientX) || !Number.isFinite(left) || !(width > 0)) return 0
  return clampSeekRatio((clientX - left) / width)
}

/**
 * `ratio × duration`, held a hair inside the end so a looped inline player
 * does not stick on `ended` when the user scrubs to the right edge.
 */
export function seekTimeFromRatio(ratio: number, duration: number): number | null {
  if (!Number.isFinite(duration) || duration <= 0) return null
  const time = clampSeekRatio(ratio) * duration
  const end = duration > 0.05 ? duration - 0.05 : duration * 0.99
  return Math.min(time, end)
}

export function canvasVideoProgressRatio(current: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(current) || current <= 0) return 0
  return clampSeekRatio(current / duration)
}

export function readCanvasVideoClock(currentTime: number, duration: number): {
  current: number
  duration: number
  ratio: number
} {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0
  const rawCurrent = Number.isFinite(currentTime) && currentTime > 0 ? currentTime : 0
  const current = safeDuration > 0 ? Math.min(rawCurrent, safeDuration) : 0
  return {
    current,
    duration: safeDuration,
    ratio: canvasVideoProgressRatio(current, safeDuration),
  }
}

export function seekTimeFromKeyboard(
  current: number,
  duration: number,
  direction: -1 | 1,
  stepSeconds = CANVAS_VIDEO_SEEK_KEY_STEP_SEC,
): number | null {
  if (!Number.isFinite(duration) || duration <= 0) return null
  const base = Number.isFinite(current) && current > 0 ? current : 0
  const step = Number.isFinite(stepSeconds) && stepSeconds > 0 ? stepSeconds : CANVAS_VIDEO_SEEK_KEY_STEP_SEC
  return seekTimeFromRatio((base + direction * step) / duration, duration)
}

/**
 * The bar is visible only while this node already owns the single canvas decoder.
 * Poster-only cards stay quiet so scrubbing never opens a second player.
 * That decoder is the selected in-view card, a committed hover, or an explicit play.
 */
export function shouldShowCanvasVideoSeekBar(input: {
  hasPlayableUrl: boolean
  suspended: boolean
  inViewport: boolean
  ownsDecoder: boolean
}): boolean {
  return Boolean(input.hasPlayableUrl && !input.suspended && input.inViewport && input.ownsDecoder)
}

/**
 * Single clip: mute sits on the bottom-right.
 * Stack: mute moves to the bottom-left and the candidate fan occupies the right.
 */
export function canvasVideoSeekBarInsets(input: {
  stacked: boolean
  fanWidth: number
}): { left: number; right: number } {
  if (!input.stacked) {
    return { left: 10, right: CANVAS_VIDEO_SEEK_MUTE_INSET }
  }
  const fan = Number.isFinite(input.fanWidth) && input.fanWidth > 0 ? input.fanWidth : 0
  return {
    left: CANVAS_VIDEO_SEEK_MUTE_INSET,
    right: CANVAS_VIDEO_SEEK_FAN_EDGE + fan + CANVAS_VIDEO_SEEK_FAN_GAP,
  }
}
