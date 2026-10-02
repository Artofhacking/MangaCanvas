import { isPlaceholderCover } from "@/lib/assetSeed"
import type { Character, EpisodeRelationItem, ObjectItem, Scene, ShapingStatus } from "@/types"
import { episodeAssetImageSrc, type EpisodeAssetKind } from "./episodeOverview"

export type EpisodeAssetPreviewTarget = {
  kind: EpisodeAssetKind
  id: number
}

export type EpisodeAssetCatalog = {
  characters: Character[]
  scenes: Scene[]
  objects: ObjectItem[]
}

export type EpisodeAssetRelations = {
  characters: EpisodeRelationItem[]
  scenes: EpisodeRelationItem[]
  objects: EpisodeRelationItem[]
}

export type EpisodeAssetPreview = {
  kind: EpisodeAssetKind
  id: number
  name: string
  image?: string
  prompt?: string
  aspectRatio?: string
  shapingStatus?: ShapingStatus
  role?: string
  style?: string
  sceneCount?: number
  model?: string
  modified?: string
  code?: string
  statusLabel?: string
  statusActive?: boolean
  objectType?: string
  objectScene?: string
  inUse?: boolean
}

type CoverSource = {
  image?: string | null
  hasImage?: boolean
}

/** Real cover only. Placeholders and missing files stay out of the large preview. */
export function coverForEpisodeDetail(image?: string | null, hasImage?: boolean): string | undefined {
  if (hasImage === false) return undefined
  const src = episodeAssetImageSrc(image)
  if (!src || isPlaceholderCover(src)) return undefined
  return src
}

function textOf(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return undefined
}

function pickCover(primary?: CoverSource | null, fallback?: CoverSource | null): string | undefined {
  return (
    (primary ? coverForEpisodeDetail(primary.image, primary.hasImage) : undefined) ??
    (fallback ? coverForEpisodeDetail(fallback.image, fallback.hasImage) : undefined)
  )
}

export function resolveEpisodeAssetPreview(
  target: EpisodeAssetPreviewTarget,
  catalog: EpisodeAssetCatalog,
  related: EpisodeAssetRelations,
): EpisodeAssetPreview | null {
  if (target.kind === "character") {
    const item = catalog.characters.find((asset) => asset.id === target.id)
    const fallback = related.characters.find((asset) => asset.id === target.id)
    if (!item && !fallback) return null
    return {
      kind: "character",
      id: target.id,
      name: item?.name || fallback?.name || "未命名角色",
      image: pickCover(item, fallback),
      prompt: textOf(item?.description, fallback?.description),
      aspectRatio: textOf(item?.aspectRatio),
      shapingStatus: item?.shapingStatus ?? fallback?.shapingStatus,
      role: item?.role || fallback?.role,
      style: textOf(item?.style),
      sceneCount: item?.scenes,
      model: textOf(item?.model),
    }
  }

  if (target.kind === "scene") {
    const item = catalog.scenes.find((asset) => asset.id === target.id)
    const fallback = related.scenes.find((asset) => asset.id === target.id)
    if (!item && !fallback) return null
    const statusActive = item ? Boolean(item.hasImage) || item.status === "in-use" : Boolean(fallback?.hasImage)
    return {
      kind: "scene",
      id: target.id,
      name: item?.name || fallback?.name || "未命名场景",
      image: pickCover(item, fallback),
      prompt: textOf(item?.description, fallback?.description),
      aspectRatio: textOf(item?.aspectRatio),
      shapingStatus: item?.shapingStatus ?? fallback?.shapingStatus,
      modified: textOf(item?.modified),
      code: textOf(item?.code),
      model: textOf(item?.model),
      statusLabel: statusActive ? "使用中" : "草稿",
      statusActive,
    }
  }

  const item = catalog.objects.find((asset) => asset.id === target.id)
  const fallback = related.objects.find((asset) => asset.id === target.id)
  if (!item && !fallback) return null
  return {
    kind: "object",
    id: target.id,
    name: item?.name || fallback?.name || "未命名物品",
    image: pickCover(item, fallback),
    prompt: textOf(item?.description, fallback?.description),
    aspectRatio: textOf(item?.aspectRatio),
    shapingStatus: item?.shapingStatus ?? fallback?.shapingStatus,
    objectType: item?.type || fallback?.type,
    objectScene: textOf(item?.scene),
    modified: textOf(item?.modified),
    model: textOf(item?.model),
    inUse: item ? item.status === "in-use" : Boolean(fallback?.hasImage),
  }
}
