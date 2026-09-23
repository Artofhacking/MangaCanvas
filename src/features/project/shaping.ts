import type { ShapingStatus } from '@/types'

export const SHAPING_LABEL: Record<ShapingStatus, string> = {
  unset: '还没定',
  semi: '提示词已锁',
  final: '已定妆',
}

export const STORYBOARD_BLOCKED_COPY = '先锁定提示词或定妆'
export const STORYBOARD_SEMI_COPY = '尚未定妆，仅按提示词约束'

export function normalizeShapingStatus(status?: ShapingStatus | null): ShapingStatus {
  if (status === 'semi' || status === 'final') return status
  return 'unset'
}

export interface ShapingAsset {
  id: number
  name: string
  description?: string
  image?: string
  hasImage?: boolean
  shapingStatus?: ShapingStatus | null
}

export interface StoryboardGate {
  blocked: boolean
  hasSemi: boolean
  unsetNames: string[]
  semiNames: string[]
  blockedMessage: string | null
  semiHint: string | null
}

function named(names: string[], copy: string) {
  const list = names.filter(Boolean)
  return list.length ? `${copy}：${list.join('、')}` : copy
}

/**
 * Assets that gate storyboard generation.
 *
 * Prefer this episode's cast (character / scene / prop links). Also include
 * characters and scenes pinned on the current shot rows, plus props whose
 * names appear in a shot prompt. Props have no shot-level id field yet.
 * An empty set means this episode does not depend on any asset, so generation stays available.
 */
export function storyboardDependencyAssets(input: {
  episodeCharacterIds?: number[]
  episodeSceneIds?: number[]
  episodeObjectIds?: number[]
  shots: Array<{ characterIds?: number[]; sceneId?: number | null; prompt?: string }>
  characters: ShapingAsset[]
  scenes: ShapingAsset[]
  objects: ShapingAsset[]
}): ShapingAsset[] {
  const picked = new Map<string, ShapingAsset>()
  const add = (kind: string, id: number | null | undefined, list: ShapingAsset[]) => {
    if (!id) return
    const asset = list.find((item) => item.id === id)
    if (!asset) return
    picked.set(`${kind}:${asset.id}`, asset)
  }

  for (const id of input.episodeCharacterIds || []) add('character', id, input.characters)
  for (const id of input.episodeSceneIds || []) add('scene', id, input.scenes)
  for (const id of input.episodeObjectIds || []) add('object', id, input.objects)

  for (const shot of input.shots) {
    for (const id of shot.characterIds || []) add('character', id, input.characters)
    add('scene', shot.sceneId, input.scenes)
    const prompt = shot.prompt || ''
    for (const object of input.objects) {
      if (object.name && prompt.includes(object.name)) picked.set(`object:${object.id}`, object)
    }
  }

  return [...picked.values()]
}

export function evaluateStoryboardGate(assets: Array<Pick<ShapingAsset, 'name' | 'shapingStatus'>>): StoryboardGate {
  const unsetNames = assets.filter((item) => normalizeShapingStatus(item.shapingStatus) === 'unset').map((item) => item.name)
  const semiNames = assets.filter((item) => normalizeShapingStatus(item.shapingStatus) === 'semi').map((item) => item.name)
  const blocked = unsetNames.length > 0
  const hasSemi = semiNames.length > 0
  return {
    blocked,
    hasSemi,
    unsetNames,
    semiNames,
    blockedMessage: blocked ? named(unsetNames, STORYBOARD_BLOCKED_COPY) : null,
    semiHint: !blocked && hasSemi ? named(semiNames, STORYBOARD_SEMI_COPY) : null,
  }
}

export function generationCover(asset: Pick<ShapingAsset, 'image' | 'hasImage' | 'shapingStatus'>): string | undefined {
  if (normalizeShapingStatus(asset.shapingStatus) !== 'final') return undefined
  if (asset.hasImage === false) return undefined
  const image = asset.image?.trim()
  return image || undefined
}

export function lockedPromptLine(asset: Pick<ShapingAsset, 'name' | 'description' | 'shapingStatus'>): string | null {
  const status = normalizeShapingStatus(asset.shapingStatus)
  if (status !== 'semi' && status !== 'final') return null
  const text = asset.description?.trim()
  if (!text) return null
  return `${asset.name}：${text}`
}
