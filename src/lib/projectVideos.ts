import { projectAssetsApi } from '@/api/projectAssetsApi'
import type { ProjectAssetDTO } from '@/api/types'

export interface ProjectVideo {
  id: number
  name: string
  url: string
  prompt: string
  createdAt: string
  updatedAt: string
  metadata?: Record<string, unknown> | null
}

export type MaterialLibraryCategory = 'character' | 'scene' | 'object' | 'video'

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|mkv|avi)(?:$|[?#])/i

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

/** A project-asset row belongs in 视频管理 when it was saved as video, or the file is a video. */
export function isProjectVideoAsset(asset: { url?: string | null; metadata?: unknown }): boolean {
  const metadata = asMetadata(asset.metadata)
  if (metadata?.category === 'video' || metadata?.mediaType === 'video') return true
  return VIDEO_EXT.test(asset.url || '')
}

export function toProjectVideo(asset: {
  id: number
  name?: string | null
  url?: string | null
  prompt?: string | null
  createdAt?: string
  updatedAt?: string
  metadata?: unknown
}): ProjectVideo | null {
  if (!asset.url || !isProjectVideoAsset(asset)) return null
  return {
    id: asset.id,
    name: asset.name?.trim() || `视频 ${asset.id}`,
    url: asset.url,
    prompt: (asset.prompt || '').trim(),
    createdAt: asset.createdAt || '',
    updatedAt: asset.updatedAt || asset.createdAt || '',
    metadata: asMetadata(asset.metadata),
  }
}

export function materialCategoryOptions(mediaType: 'image' | 'video') {
  const stills = [
    { label: '角色', value: 'character' as const },
    { label: '场景', value: 'scene' as const },
    { label: '物品', value: 'object' as const },
  ]
  if (mediaType === 'video') {
    return [{ label: '视频', value: 'video' as const }, ...stills]
  }
  return stills
}

export function normalizeMaterialCategory(
  value: string | undefined,
  mediaType: 'image' | 'video',
): MaterialLibraryCategory {
  if (value === 'video') return mediaType === 'video' ? 'video' : 'object'
  if (value === 'character' || value === 'scene' || value === 'object') return value
  return mediaType === 'video' ? 'video' : 'object'
}

export async function listProjectVideoAssets(projectId: number): Promise<ProjectAssetDTO[]> {
  const pageSize = 200
  const first = await projectAssetsApi.list(projectId, { page: 1, size: pageSize, mediaType: 'video' })
  const items = [...(first.list || [])]
  const total = first.pagination?.total ?? items.length
  let page = 2
  while (items.length < total && page <= 10) {
    const next = await projectAssetsApi.list(projectId, { page, size: pageSize, mediaType: 'video' })
    const batch = next.list || []
    if (!batch.length) break
    items.push(...batch)
    page += 1
  }
  return items.filter(isProjectVideoAsset)
}
