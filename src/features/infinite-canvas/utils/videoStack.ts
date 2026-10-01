import { mediaUrl } from '@/lib/mediaUrl'
import type { NodeData } from '../types'
import { nextMediaPixelFields } from './mediaFrame'

function sameMediaUrl(left: string, right: string): boolean {
  if (left === right) return true
  const normalizedLeft = mediaUrl(left)
  const normalizedRight = mediaUrl(right)
  return Boolean(normalizedLeft) && normalizedLeft === normalizedRight
}

/**
 * Video results stack the same way images do.
 * `url` is always the front clip. `videoUrls` is set only when there is more than one.
 * `thumbnailUrls` lines up with `videoUrls` and is optional; empty slots fall back to a number.
 */

export interface VideoStack {
  urls: string[]
  /** Parallel to `urls`. Empty string means the corner card has no still yet. */
  thumbnails: string[]
  activeIndex: number
}

export interface GeneratedVideoNotice {
  level: 'success' | 'warning' | 'error'
  text: string
}

export interface GeneratedVideoOutcome {
  ok: boolean
  patch: Partial<NodeData>
  notice: GeneratedVideoNotice
}

function normalizeVideoUrls(value: unknown): string[] {
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

function posterAt(posters: readonly unknown[] | undefined, index: number): string {
  const raw = posters?.[index]
  return typeof raw === 'string' ? raw.trim() : ''
}

/** Keep the first poster that belongs to each kept URL. Blanks and duplicate URLs drop out together. */
function pairVideoResults(
  urls: readonly unknown[],
  posters?: readonly unknown[],
): { url: string; poster: string }[] {
  const seen = new Set<string>()
  const rows: { url: string; poster: string }[] = []
  urls.forEach((item, index) => {
    if (typeof item !== 'string') return
    const url = item.trim()
    if (!url || seen.has(url)) return
    seen.add(url)
    rows.push({ url, poster: posterAt(posters, index) })
  })
  return rows
}

function readThumbnailSlots(value: unknown, count: number): string[] {
  const raw = Array.isArray(value) ? value : []
  return Array.from({ length: count }, (_, index) => {
    const item = raw[index]
    return typeof item === 'string' ? item.trim() : ''
  })
}

export function readVideoStack(data: {
  url?: unknown
  videoUrls?: unknown
  thumbnailUrls?: unknown
  thumbnail?: unknown
  activeVideoIndex?: unknown
} | null | undefined): VideoStack {
  if (!data) return { urls: [], thumbnails: [], activeIndex: 0 }
  const listed = normalizeVideoUrls(data.videoUrls)
  const url = typeof data.url === 'string' ? data.url.trim() : ''
  const singleThumb = typeof data.thumbnail === 'string' ? data.thumbnail.trim() : ''

  if (listed.length > 1) {
    const fromUrl = url ? listed.findIndex((item) => sameMediaUrl(item, url)) : -1
    const raw = data.activeVideoIndex
    const activeIndex = fromUrl >= 0
      ? fromUrl
      : (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw < listed.length ? raw : 0)
    const thumbnails = readThumbnailSlots(data.thumbnailUrls, listed.length)
    if (!thumbnails[activeIndex] && singleThumb) thumbnails[activeIndex] = singleThumb
    return { urls: listed, thumbnails, activeIndex }
  }

  if (url) return { urls: [url], thumbnails: [singleThumb], activeIndex: 0 }
  if (listed.length === 1) return { urls: listed, thumbnails: [singleThumb], activeIndex: 0 }
  return { urls: [], thumbnails: [], activeIndex: 0 }
}

/** Move one candidate to the front. No-op when it is already front, or there is no stack. */
export function bringStackVideoForward(
  data: {
    url?: unknown
    videoUrls?: unknown
    thumbnailUrls?: unknown
    thumbnail?: unknown
    activeVideoIndex?: unknown
  } | null | undefined,
  index: number,
): { url: string; activeIndex: number; thumbnail?: string } | null {
  const stack = readVideoStack(data)
  if (stack.urls.length <= 1) return null
  if (!Number.isInteger(index) || index < 0 || index >= stack.urls.length) return null
  if (index === stack.activeIndex) return null
  const thumbnail = stack.thumbnails[index] || undefined
  return { url: stack.urls[index], activeIndex: index, thumbnail }
}

export function videoStackActivationPatch(
  data: {
    url?: unknown
    videoUrls?: unknown
    thumbnailUrls?: unknown
    thumbnail?: unknown
    activeVideoIndex?: unknown
  } | null | undefined,
  index: number,
): Partial<NodeData> | null {
  const next = bringStackVideoForward(data, index)
  if (!next) return null
  return {
    url: next.url,
    activeVideoIndex: next.activeIndex,
    thumbnail: next.thumbnail,
    ...nextMediaPixelFields(null),
  }
}

/**
 * Node patch after a video generation.
 * Every returned URL is kept. `url` is the first clip so preview, download, and downstream refs stay on the front.
 * One URL clears any previous stack. Zero URLs is a failure and does not wipe the previous video.
 */
export function buildGeneratedVideoNodePatch(input: {
  urls: readonly unknown[]
  posters?: readonly unknown[]
  requestedCount: number
  nodeId: string
  now?: number
}): GeneratedVideoOutcome {
  const rows = pairVideoResults(input.urls, input.posters)
  const requested = Number.isFinite(input.requestedCount) && input.requestedCount > 0
    ? Math.floor(input.requestedCount)
    : 1

  if (rows.length === 0) {
    return {
      ok: false,
      patch: {
        loading: false,
        error: '生成失败',
        progress: undefined,
        statusLabel: undefined,
        videoJobIds: undefined,
      },
      notice: { level: 'error', text: '生成失败' },
    }
  }

  const urls = rows.map((row) => row.url)
  const stacked = urls.length > 1
  const short = urls.length < requested
  const posters = rows.map((row) => row.poster)
  const hasPoster = posters.some(Boolean)
  return {
    ok: true,
    patch: {
      url: urls[0],
      videoUrls: stacked ? urls : undefined,
      thumbnailUrls: stacked && hasPoster ? posters : undefined,
      activeVideoIndex: stacked ? 0 : undefined,
      thumbnail: posters[0] || undefined,
      ...nextMediaPixelFields(null),
      loading: false,
      error: '',
      progress: undefined,
      statusLabel: undefined,
      videoJobIds: undefined,
      updatedAt: input.now ?? Date.now(),
      executed: true,
      outputNodeId: input.nodeId,
    },
    notice: short
      ? { level: 'warning', text: `已生成 ${urls.length} 条，少于请求的 ${requested} 条` }
      : {
          level: 'success',
          text: urls.length > 1 ? `已生成 ${urls.length} 条视频` : '视频生成完成！',
        },
  }
}
