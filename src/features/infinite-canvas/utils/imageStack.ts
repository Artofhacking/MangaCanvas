import { mediaUrl } from '@/lib/mediaUrl'
import type { NodeData } from '../types'
import { nextMediaPixelFields } from './mediaFrame'

/** Corner card size for the in-node stack. The front image still fills the stage. */
export const IMAGE_STACK_CARD = 76
export const IMAGE_STACK_STEP_X = 52
export const IMAGE_STACK_STEP_Y = 6

export interface ImageStack {
  urls: string[]
  /** Index of the front image. `url` on the node matches this entry when it is in the list. */
  activeIndex: number
}

export interface StackCardPlacement {
  index: number
  depth: number
  right: number
  bottom: number
  zIndex: number
  rotate: number
}

export interface GeneratedImageNotice {
  level: 'success' | 'warning' | 'error'
  text: string
}

export interface GeneratedImageOutcome {
  ok: boolean
  patch: Partial<NodeData>
  notice: GeneratedImageNotice
}

function sameMediaUrl(left: string, right: string): boolean {
  if (left === right) return true
  const normalizedLeft = mediaUrl(left)
  const normalizedRight = mediaUrl(right)
  return Boolean(normalizedLeft) && normalizedLeft === normalizedRight
}

/** Trim, drop empties, and keep the first occurrence of each URL. */
export function normalizeImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const urls: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const url = item.trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
  }
  return urls
}

/**
 * Candidates stored on a canvas image node.
 * A single URL (or none) stays a normal image: no stack chrome.
 * When several URLs exist, the node's `url` is the front image.
 */
export function readImageStack(data: {
  url?: unknown
  imageUrls?: unknown
  activeImageIndex?: unknown
} | null | undefined): ImageStack {
  if (!data) return { urls: [], activeIndex: 0 }
  const listed = normalizeImageUrls(data.imageUrls)
  const url = typeof data.url === 'string' ? data.url.trim() : ''

  if (listed.length > 1) {
    const fromUrl = url ? listed.findIndex((item) => sameMediaUrl(item, url)) : -1
    if (fromUrl >= 0) return { urls: listed, activeIndex: fromUrl }
    const raw = data.activeImageIndex
    const index = typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw < listed.length ? raw : 0
    return { urls: listed, activeIndex: index }
  }

  if (url) return { urls: [url], activeIndex: 0 }
  if (listed.length === 1) return { urls: listed, activeIndex: 0 }
  return { urls: [], activeIndex: 0 }
}

/**
 * Cards behind the front image, fanned toward the top-left of the corner.
 * The active image is omitted — it is the full-bleed frame.
 */
export function placeStackCandidates(count: number, activeIndex: number): StackCardPlacement[] {
  const total = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
  if (total <= 1) return []
  const active = Number.isInteger(activeIndex) && activeIndex >= 0 && activeIndex < total ? activeIndex : 0
  const indexes: number[] = []
  for (let index = 0; index < total; index += 1) {
    if (index !== active) indexes.push(index)
  }
  const center = (indexes.length - 1) / 2
  return indexes.map((index, order) => {
    const depth = indexes.length - 1 - order
    return {
      index,
      depth,
      right: depth * IMAGE_STACK_STEP_X,
      bottom: depth * IMAGE_STACK_STEP_Y,
      zIndex: 20 + order,
      rotate: (order - center) * 3,
    }
  })
}

/** Move one candidate to the front. No-op when it is already front, or there is no stack. */
export function bringStackImageForward(
  data: {
    url?: unknown
    imageUrls?: unknown
    activeImageIndex?: unknown
  } | null | undefined,
  index: number,
): { url: string; activeIndex: number } | null {
  const stack = readImageStack(data)
  if (stack.urls.length <= 1) return null
  if (!Number.isInteger(index) || index < 0 || index >= stack.urls.length) return null
  if (index === stack.activeIndex) return null
  return { url: stack.urls[index], activeIndex: index }
}

/**
 * Node patch after an image generation.
 * Every returned URL is kept. `url` is the first image so downstream readers stay on the front.
 * One URL clears any previous stack. Zero URLs is a failure and does not wipe the previous image.
 */
export function buildGeneratedImageNodePatch(input: {
  urls: readonly unknown[]
  requestedCount: number
  nodeId: string
  now?: number
}): GeneratedImageOutcome {
  const urls = normalizeImageUrls(input.urls)
  const requested = Number.isFinite(input.requestedCount) && input.requestedCount > 0
    ? Math.floor(input.requestedCount)
    : 1

  if (urls.length === 0) {
    return {
      ok: false,
      patch: { loading: false, error: '生成失败', progress: undefined },
      notice: { level: 'error', text: '生成失败' },
    }
  }

  const stacked = urls.length > 1
  const short = urls.length < requested
  return {
    ok: true,
    patch: {
      url: urls[0],
      imageUrls: stacked ? urls : undefined,
      activeImageIndex: stacked ? 0 : undefined,
      base64: undefined,
      thumbnail: undefined,
      ...nextMediaPixelFields(null),
      loading: false,
      error: '',
      progress: undefined,
      updatedAt: input.now ?? Date.now(),
      executed: true,
      outputNodeId: input.nodeId,
    },
    notice: short
      ? { level: 'warning', text: `已生成 ${urls.length} 张，少于请求的 ${requested} 张` }
      : {
          level: 'success',
          text: urls.length > 1 ? `已生成 ${urls.length} 张图片` : '图片生成成功！',
        },
  }
}
