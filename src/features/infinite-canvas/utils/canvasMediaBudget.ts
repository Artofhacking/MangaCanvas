/**
 * Browser-side memory budget for a heavy workflow canvas.
 *
 * React Flow `onlyRenderVisibleElements` still mounts every node that has no
 * width/height yet (`notInitialized` counts as visible). `fitView` runs only
 * after that measurement, so the first paint uses the saved viewport — often
 * zoomed in — and then the fit-all view puts the whole graph on screen.
 *
 * Generated image nodes usually have no thumbnail, or the same URL as the full
 * asset. Putting that URL on an `<img>` decodes the intrinsic bitmap (often
 * 2K). Doing that for every card on open kills the Chromium renderer
 * (Aw Snap / error code 5).
 *
 * LibLib-style LOD: the opening fitView only shows a distinct thumbnail, a
 * downscaled display bitmap, or a placeholder. The original asset is mounted
 * after the user zooms into a region, and only on the card. Lightbox,
 * download, and save-to-library keep the original URL. A real server-side
 * thumbnail (separate small object) is not generated here.
 *
 * That is separate from the MySQL sort-memory error on the workflow list.
 */

/** Passed to `<ReactFlow onlyRenderVisibleElements>`. */
export const CANVAS_ONLY_RENDER_VISIBLE_ELEMENTS = true

/**
 * Cards only earn an original bitmap once they are large on screen.
 * The opening fitView is never enough by itself: a fitted zoom of 1 still
 * stays on the thumbnail or a placeholder until the user zooms further in.
 */
export const CANVAS_FULL_RES_MIN_ZOOM = 0.85

/**
 * Ignore float noise from fitView. Full-res starts only after zoom moves
 * past the captured overview by at least this much (LibLib-style LOD).
 */
export const CANVAS_LOD_ZOOM_EPSILON = 0.05

/**
 * Concurrent original-asset bitmaps. A zoomed-in screen of ~448px cards is
 * covered by a handful of sharp images; the rest stay on a small preview.
 */
export const CANVAS_MAX_FULL_RES_IMAGES = 4

/**
 * Concurrent `<img>` decodes of a distinct thumbnail URL. Fit-all used to
 * start every thumbnail at once when the URL differed from the asset.
 */
export const CANVAS_MAX_PREVIEW_IMAGES = 8

/** Live downscaled card bitmaps (object URLs). Each one is capped at 256px. */
export const CANVAS_MAX_DISPLAY_BITMAPS = 12

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
  /** False when the card does not overlap the pane, or has not been measured. */
  inViewport: boolean
  /** False until React Flow has written width and height. Unmeasured nodes mount for every card. */
  measured: boolean
  /** False until the opening fitView has committed. The pre-fit frame stays blank. */
  viewportSettled: boolean
  /** False while the canvas is zoomed out (fit-all of a large graph). */
  allowFullResolution: boolean
  /** False when the global full-resolution decode cap is already full. */
  fullResGranted: boolean
  /** False when the distinct-thumbnail `<img>` cap is already full. */
  previewGranted: boolean
  /** False when the downscaled card-bitmap cap is already full. */
  displayGranted: boolean
}

export type CanvasImageDisplayMode = 'empty' | 'preview' | 'full' | 'downscale'

export interface CanvasImageDisplayPlan {
  mode: CanvasImageDisplayMode
  /** Immediate `<img src>`. Empty for a placeholder or a pending downscale. */
  src: string
  /** Asset to turn into a small object URL. Lightbox still uses the original. */
  downscaleUrl: string
}

const EMPTY_CANVAS_IMAGE: CanvasImageDisplayPlan = { mode: 'empty', src: '', downscaleUrl: '' }

/**
 * Same-origin static/API paths, data URLs, and blob URLs can be fetched and
 * drawn down without tainting a canvas. Remote CDN urls cannot; those stay
 * empty until a full-resolution slot is granted.
 */
export function canDownscaleCanvasImageUrl(url: string | null | undefined): boolean {
  const trimmed = (url || '').trim()
  if (!trimmed) return false
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:')) return true
  try {
    const base = typeof window !== 'undefined' && window.location?.href ? window.location.href : 'http://local/'
    const parsed = new URL(trimmed, base)
    return parsed.pathname.startsWith('/static/') || parsed.pathname.startsWith('/api/')
  } catch {
    return false
  }
}

/**
 * Node chrome only. Download, lightbox, and save-to-materials keep the original
 * asset URL and do not use this value.
 *
 * An identical thumbnail is not a cheap preview — callers stored the full URL
 * in both fields. Those cards either downsample or wait for a full-res slot.
 */
export function resolveCanvasImageDisplay(input: CanvasImageSourceInput): CanvasImageDisplayPlan {
  if (!input.inViewport || !input.measured || !input.viewportSettled) return EMPTY_CANVAS_IMAGE
  const full = (input.url || '').trim()
  const thumb = (input.thumbnail || '').trim()
  const distinctThumb = Boolean(thumb && thumb !== full)
  if (distinctThumb) {
    if (!input.previewGranted) return EMPTY_CANVAS_IMAGE
    return { mode: 'preview', src: thumb, downscaleUrl: '' }
  }
  if (full && input.allowFullResolution && input.fullResGranted) {
    return { mode: 'full', src: full, downscaleUrl: '' }
  }
  if (full && canDownscaleCanvasImageUrl(full)) {
    if (!input.displayGranted) return EMPTY_CANVAS_IMAGE
    return { mode: 'downscale', src: '', downscaleUrl: full }
  }
  return EMPTY_CANVAS_IMAGE
}

/** @deprecated Use `resolveCanvasImageDisplay`. Returns only an immediate URL. */
export function resolveCanvasImageDisplaySrc(input: CanvasImageSourceInput): string {
  const plan = resolveCanvasImageDisplay(input)
  return plan.mode === 'downscale' ? '' : plan.src
}

/** True once React Flow has applied the initial `fitView`. */
export function isCanvasFitViewSettled(state: { fitViewOnInitDone?: boolean } | null | undefined): boolean {
  return state?.fitViewOnInitDone === true
}

/**
 * Full-resolution cards are a zoom-in LOD, not the opening fit.
 * `overviewZoom` is the zoom captured when fitView settled. Until the user
 * zooms past that baseline, missing thumbnails stay placeholders (or a
 * downscaled display bitmap) and never become `<img src=original>`.
 */
export function allowsCanvasFullResolution(zoom: number, overviewZoom: number | null): boolean {
  if (overviewZoom == null || !(overviewZoom > 0) || !(zoom > 0)) return false
  return zoom >= CANVAS_FULL_RES_MIN_ZOOM && zoom > overviewZoom + CANVAS_LOD_ZOOM_EPSILON
}

let canvasOverviewZoom: number | null = null
let canvasOverviewCaptured = false
const canvasOverviewListeners = new Set<() => void>()

function emitCanvasOverviewZoom() {
  canvasOverviewListeners.forEach((listener) => listener())
}

export function getCanvasOverviewZoom(): number | null {
  return canvasOverviewZoom
}

export function subscribeCanvasOverviewZoom(listener: () => void) {
  canvasOverviewListeners.add(listener)
  return () => {
    canvasOverviewListeners.delete(listener)
  }
}

/** Forget the baseline so the next sample becomes the overview (open, or the fit button). */
export function armCanvasOverviewCapture() {
  if (!canvasOverviewCaptured && canvasOverviewZoom == null) return
  canvasOverviewCaptured = false
  canvasOverviewZoom = null
  emitCanvasOverviewZoom()
}

/** Record the fitView zoom once. Later zoom-in is what unlocks full-res LOD. */
export function captureCanvasOverviewZoom(zoom: number) {
  if (canvasOverviewCaptured) return
  if (!(zoom > 0)) return
  canvasOverviewZoom = zoom
  canvasOverviewCaptured = true
  emitCanvasOverviewZoom()
}

/** Call when a workflow starts loading so the next measured graph fitViews before images decode. */
export function deferCanvasFitView(store: { setState: (partial: { fitViewOnInitDone: boolean }) => void }) {
  store.setState({ fitViewOnInitDone: false })
  armCanvasOverviewCapture()
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

const fullResPool = createSlotPool(CANVAS_MAX_FULL_RES_IMAGES)
const previewPool = createSlotPool(CANVAS_MAX_PREVIEW_IMAGES)
const displayPool = createSlotPool(CANVAS_MAX_DISPLAY_BITMAPS)

function createSlotPool(max: number) {
  const holders = new Set<string>()
  const listeners = new Set<() => void>()
  const emit = () => {
    listeners.forEach((listener) => listener())
  }
  return {
    claim(id: string) {
      if (holders.has(id)) return true
      if (holders.size >= max) return false
      holders.add(id)
      emit()
      return true
    },
    release(id: string) {
      if (!holders.delete(id)) return
      emit()
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    clear() {
      holders.clear()
      listeners.clear()
    },
  }
}

function emitVideo() {
  videoListeners.forEach((listener) => listener())
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
  return fullResPool.claim(id)
}

export function releaseCanvasFullResImage(id: string) {
  fullResPool.release(id)
}

export function subscribeCanvasFullResImages(listener: () => void) {
  return fullResPool.subscribe(listener)
}

/** Distinct thumbnail `<img>` elements. */
export function claimCanvasPreviewImage(id: string): boolean {
  return previewPool.claim(id)
}

export function releaseCanvasPreviewImage(id: string) {
  previewPool.release(id)
}

export function subscribeCanvasPreviewImages(listener: () => void) {
  return previewPool.subscribe(listener)
}

/** Downscaled object-URL previews. */
export function claimCanvasDisplayBitmap(id: string): boolean {
  return displayPool.claim(id)
}

export function releaseCanvasDisplayBitmap(id: string) {
  displayPool.release(id)
}

export function subscribeCanvasDisplayBitmaps(listener: () => void) {
  return displayPool.subscribe(listener)
}

export function resetCanvasMediaBudgetForTests() {
  videoIntents.clear()
  activeVideoId = null
  videoInteractionSeq = 0
  videoListeners.clear()
  fullResPool.clear()
  previewPool.clear()
  displayPool.clear()
  canvasOverviewZoom = null
  canvasOverviewCaptured = false
  canvasOverviewListeners.clear()
}
