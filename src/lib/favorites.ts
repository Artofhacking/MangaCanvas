export type CollectSource = 'favorite' | 'collect'
export type CollectMediaType = 'image' | 'video'
export type CollectCategory = 'character' | 'scene' | 'object'

export const COLLECT_SOURCES: readonly CollectSource[] = ['favorite', 'collect']

export const COLLECT_CATEGORY_LABEL: Record<CollectCategory, string> = {
  character: '角色',
  scene: '场景',
  object: '物品',
}

export function isCollectedMetadata(metadata?: Record<string, unknown> | null): boolean {
  if (!metadata || typeof metadata !== 'object') return false
  const source = metadata.source
  if (source === 'favorite' || source === 'collect') return true
  return typeof metadata.favoritedAt === 'string' && metadata.favoritedAt.length > 0
}

export function isCollectedAsset(asset: { metadata?: Record<string, unknown> | null }): boolean {
  return isCollectedMetadata(asset.metadata)
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
