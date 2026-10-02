export type CollectSource = 'favorite' | 'collect'
export type CollectMediaType = 'image' | 'video'
export type CollectCategory = 'character' | 'scene' | 'object'

export const COLLECT_SOURCES: readonly CollectSource[] = ['favorite', 'collect']

export const COLLECT_CATEGORY_LABEL: Record<CollectCategory, string> = {
  character: '角色',
  scene: '场景',
  object: '物品',
}

export const FAVORITES_CHANGED_EVENT = 'mangacanvas-favorites-changed'

export function notifyFavoritesChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT))
}

function asMetadata(metadata: unknown): Record<string, unknown> | null {
  if (!metadata) return null
  if (typeof metadata === 'string') {
    try {
      return asMetadata(JSON.parse(metadata) as unknown)
    } catch {
      return null
    }
  }
  if (typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>
  }
  return null
}

export function isCollectedMetadata(metadata?: unknown): boolean {
  const data = asMetadata(metadata)
  if (!data) return false
  const source = data.source
  if (source === 'favorite' || source === 'collect') return true
  return typeof data.favoritedAt === 'string' && data.favoritedAt.length > 0
}

export function isCollectedAsset(asset: { metadata?: unknown }): boolean {
  return isCollectedMetadata(asset.metadata)
}

/** Host and query are ignored so a preview URL matches the stored asset URL. */
export function mediaIdentity(url?: string | null): string {
  if (!url) return ''
  const trimmed = url.trim()
  if (!trimmed) return ''
  try {
    const parsed = new URL(trimmed, 'http://local.invalid')
    const path = parsed.pathname || '/'
    if (path.startsWith('/static/') || path.startsWith('/api/')) return path
    if (parsed.origin && parsed.origin !== 'http://local.invalid') {
      return `${parsed.origin}${path}`.replace(/\/$/, '')
    }
  } catch {
    // Keep the raw value when it is not a URL.
  }
  return trimmed.split('?')[0].replace(/\/$/, '')
}

function hash12(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36).padStart(7, '0').slice(0, 12)
}

export function favoriteSourceId(nodeId?: string | null, url?: string | null): string {
  const node = (nodeId || 'node').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'node'
  return `fav_${node}_${hash12(mediaIdentity(url))}`.slice(0, 64)
}

function favoriteIdentities(
  url?: string | null,
  metadata?: Record<string, unknown> | null,
  sourceUrl?: string | null,
): string[] {
  const storedSource = typeof metadata?.sourceUrl === 'string' ? metadata.sourceUrl : undefined
  return [mediaIdentity(url), mediaIdentity(sourceUrl), mediaIdentity(storedSource)].filter(
    (value, index, all) => Boolean(value) && all.indexOf(value) === index,
  )
}

export function isSameFavoriteTarget(
  asset: { url?: string | null; metadata?: Record<string, unknown> | null },
  target: { url?: string | null; nodeId?: string | null; sourceUrl?: string | null },
): boolean {
  const left = favoriteIdentities(asset.url, asset.metadata)
  const right = favoriteIdentities(target.url, null, target.sourceUrl)
  if (!right.length || !left.some((item) => right.includes(item))) return false
  const existing = asset.metadata?.nodeId
  if (target.nodeId && typeof existing === 'string' && existing.length > 0 && existing !== target.nodeId) {
    return false
  }
  return true
}

export function stripCollectMetadata(metadata?: Record<string, unknown> | null): Record<string, unknown> {
  const next = { ...(metadata || {}) }
  delete next.favoritedAt
  if (next.source === 'favorite' || next.source === 'collect') {
    delete next.source
  }
  return next
}

export function buildCollectMetadata(
  base: Record<string, unknown>,
  collected: boolean,
  favoritedAt = new Date().toISOString(),
): Record<string, unknown> {
  if (!collected) return { ...base }
  return {
    ...base,
    source: 'favorite' satisfies CollectSource,
    favoritedAt,
  }
}

export function collectCategoryLabel(category?: unknown): string {
  if (category === 'character' || category === 'scene' || category === 'object') {
    return COLLECT_CATEGORY_LABEL[category]
  }
  return '素材'
}

export function inferCollectMediaType(
  url?: string | null,
  metadata?: Record<string, unknown> | null,
): CollectMediaType {
  if (metadata?.mediaType === 'video') return 'video'
  if (metadata?.mediaType === 'image') return 'image'
  const value = (url || '').toLowerCase()
  if (/\.(mp4|mov|webm)(\?|$)/i.test(value)) return 'video'
  return 'image'
}

export function collectFavoritedAt(metadata?: Record<string, unknown> | null): string | undefined {
  const value = metadata?.favoritedAt
  return typeof value === 'string' && value.length > 0 ? value : undefined
}
