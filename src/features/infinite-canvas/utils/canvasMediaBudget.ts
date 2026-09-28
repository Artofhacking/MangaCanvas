/**
 * Browser-side memory budget for a heavy workflow canvas.
 *
 * React Flow `onlyRenderVisibleElements` unmounts nodes once they have been
 * measured and sit outside the pane. `fitView` on open still places every
 * node on screen, so culling alone does not stop the first paint from
 * decoding every image and autoplaying every video (Chrome "Out of Memory").
 * That is separate from the MySQL sort-memory error on the workflow list.
 */

/** Passed to `<ReactFlow onlyRenderVisibleElements>`. */
export const CANVAS_ONLY_RENDER_VISIBLE_ELEMENTS = true

/**
 * A 448px card is about 180px on screen. Below this zoom, skip full-resolution
 * bitmaps; a distinct thumbnail may still show.
 */
export const CANVAS_FULL_RES_MIN_ZOOM = 0.4

/**
 * Concurrent full-resolution bitmaps (image cards and video posters).
 * Large enough for one zoomed-in screen of ~448px cards, small enough that a
 * fit-all view cannot decode the whole graph.
 */
export const CANVAS_MAX_FULL_RES_IMAGES = 24

/** Ignore a quick pointer pass over a video card. */
export const CANVAS_VIDEO_HOVER_PLAY_MS = 200

/** Fraction of the node box that must sit inside the pane before a video plays. */
export const CANVAS_VIDEO_MIN_VISIBLE_RATIO = 0.35

/** Start image work as soon as a sliver of the card is on screen. */
export const CANVAS_IMAGE_MIN_VISIBLE_RATIO = 0.02

export interface FlowNodeViewportInput {
  nodeX: number
  nodeY: number
  nodeWidth: number
  nodeHeight: number
  translateX: number
  translateY: number
  zoom: number
  paneWidth: number
  paneHeight: number
  minVisibleRatio?: number
}

/** Screen-space overlap of a flow node with the React Flow pane. */
export function flowNodeVisibleRatio(input: FlowNodeViewportInput): number {
  const zoom = input.zoom
  if (!(zoom > 0) || input.nodeWidth <= 0 || input.nodeHeight <= 0) return 0
  if (input.paneWidth <= 0 || input.paneHeight <= 0) return 0

  const left = input.nodeX * zoom + input.translateX
  const top = input.nodeY * zoom + input.translateY
  const width = input.nodeWidth * zoom
  const height = input.nodeHeight * zoom
  const right = left + width
  const bottom = top + height

  const overlapWidth = Math.max(0, Math.min(right, input.paneWidth) - Math.max(left, 0))
  const overlapHeight = Math.max(0, Math.min(bottom, input.paneHeight) - Math.max(top, 0))
  const area = width * height
  if (area <= 0) return 0
  return (overlapWidth * overlapHeight) / area
}

export function flowNodeIntersectsViewport(input: FlowNodeViewportInput): boolean {
  const minVisibleRatio = input.minVisibleRatio ?? 0.02
  return flowNodeVisibleRatio(input) >= minVisibleRatio
}

export interface CanvasImageSourceInput {
  url?: string | null
  thumbnail?: string | null
  inViewport: boolean
  /** False while the canvas is zoomed out (fit-all of a large graph). */
  allowFullResolution: boolean
  /** False when the global full-resolution decode cap is already full. */
  fullResGranted: boolean
}

/**
 * Node chrome src. Download, lightbox, and save-to-materials keep the original
 * asset URL and do not use this value.
 */
export function resolveCanvasImageDisplaySrc(input: CanvasImageSourceInput): string {
  if (!input.inViewport) return ''
  const full = (input.url || '').trim()
  const thumb = (input.thumbnail || '').trim()
  if (thumb && thumb !== full) return thumb
  if (!full || !input.allowFullResolution || !input.fullResGranted) return ''
  return full
}

export interface VideoPlaybackIntent {
  id: string
  inViewport: boolean
  selected: boolean
  hovered: boolean
  playRequested: boolean
  /** Increases when hover or an explicit play click turns on, so the latest gesture wins. */
  explicitSeq: number
}

/**
 * At most one canvas video attaches a media source.
 * Idle mounted nodes (including every card visible after fit-view) stay on the poster.
 */
export function resolveActiveVideoId(
  previousId: string | null,
  intents: readonly VideoPlaybackIntent[],
): string | null {
  let explicit: VideoPlaybackIntent | null = null
  for (const intent of intents) {
    if (!intent.inViewport || (!intent.hovered && !intent.playRequested)) continue
    if (!explicit || intent.explicitSeq >= explicit.explicitSeq) explicit = intent
  }
  if (explicit) return explicit.id

  const selectedInView = intents.filter((intent) => intent.inViewport && intent.selected)
  if (selectedInView.length === 1) return selectedInView[0].id
  if (previousId && selectedInView.some((intent) => intent.id === previousId)) return previousId
  return null
}

/** Attributes for the single video element that is allowed to decode. */
export function activeCanvasVideoProps(muted: boolean) {
  return {
    autoPlay: true as const,
    loop: true as const,
    muted,
    playsInline: true as const,
  }
}

type VideoIntentState = Omit<VideoPlaybackIntent, 'id'>

const videoIntents = new Map<string, VideoIntentState>()
let activeVideoId: string | null = null
let videoInteractionSeq = 0
const videoListeners = new Set<() => void>()

const fullResHolders = new Set<string>()
const fullResListeners = new Set<() => void>()

function emitVideo() {
  videoListeners.forEach((listener) => listener())
}

function emitFullRes() {
  fullResListeners.forEach((listener) => listener())
}

export function nextCanvasVideoInteractionSeq(): number {
  videoInteractionSeq += 1
  return videoInteractionSeq
}

export function setCanvasVideoIntent(id: string, intent: VideoIntentState | null) {
  if (intent == null) {
    if (!videoIntents.delete(id)) return
  } else {
    const prev = videoIntents.get(id)
    if (
      prev &&
      prev.inViewport === intent.inViewport &&
      prev.selected === intent.selected &&
      prev.hovered === intent.hovered &&
      prev.playRequested === intent.playRequested &&
      prev.explicitSeq === intent.explicitSeq
    ) {
      return
    }
    videoIntents.set(id, intent)
  }

  const list: VideoPlaybackIntent[] = []
  videoIntents.forEach((value, key) => {
    list.push({ id: key, ...value })
  })
  const next = resolveActiveVideoId(activeVideoId, list)
  if (next === activeVideoId) return
  activeVideoId = next
  emitVideo()
}

export function getActiveCanvasVideoId(): string | null {
  return activeVideoId
}

export function subscribeActiveCanvasVideo(listener: () => void) {
  videoListeners.add(listener)
  return () => {
    videoListeners.delete(listener)
  }
}

/** Returns true when this node may decode its full-resolution bitmap. */
export function claimCanvasFullResImage(id: string): boolean {
  if (fullResHolders.has(id)) return true
  if (fullResHolders.size >= CANVAS_MAX_FULL_RES_IMAGES) return false
  fullResHolders.add(id)
  emitFullRes()
  return true
}

export function releaseCanvasFullResImage(id: string) {
  if (!fullResHolders.delete(id)) return
  emitFullRes()
}

export function subscribeCanvasFullResImages(listener: () => void) {
  fullResListeners.add(listener)
  return () => {
    fullResListeners.delete(listener)
  }
}

export function resetCanvasMediaBudgetForTests() {
  videoIntents.clear()
  activeVideoId = null
  videoInteractionSeq = 0
  videoListeners.clear()
  fullResHolders.clear()
  fullResListeners.clear()
}
