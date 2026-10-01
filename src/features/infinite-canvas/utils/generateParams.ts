import { isMiniMaxModel, isSeedanceModel, isT2VModel, isViduModel } from '@/api/aigc'
import {
  remapModelId,
  resolveImageCapabilities,
  resolveVideoCapabilities,
} from '../config/modelCapabilities'
import { remapVideoModel } from '../config/models'
import type { CustomNode, ModelConfig, NodeData, SizeOption } from '../types'
import { getSizeRatio, labeledSizes, uniqueAspectRatios } from './aspectRatio'

export { getSizeRatio, uniqueAspectRatios } from './aspectRatio'

export const ASPECT_RATIOS = ['16:9', '4:3', '1:1', '3:4', '9:16'] as const
export const RESOLUTIONS = ['1080P', '720P'] as const

export type AspectRatio = (typeof ASPECT_RATIOS)[number]
export type Resolution = (typeof RESOLUTIONS)[number]

/** Pixel sizes the dock writes beside an official ratio. HappyHorse itself sends `ratio`. */
export const VIDEO_SIZE_MAP: Record<Resolution, Record<string, string>> = {
  '720P': {
    '16:9': '1280*720',
    '9:16': '720*1280',
    '1:1': '960*960',
    '4:3': '1088*832',
    '3:4': '832*1088',
    '4:5': '576*720',
    '5:4': '900*720',
    '21:9': '1680*720',
    '9:21': '720*1680',
  },
  '1080P': {
    '16:9': '1920*1080',
    '9:16': '1080*1920',
    '1:1': '1440*1440',
    '4:3': '1632*1248',
    '3:4': '1248*1632',
    '4:5': '864*1080',
    '5:4': '1350*1080',
    '21:9': '2520*1080',
    '9:21': '1080*2520',
  },
}

export function getShortLabelFromModel(modelLabel: string): string {
  const match = modelLabel.match(/[文图]生[图视频]+|关键帧生视频/)
  return match ? match[0] : '文生图'
}

export function parseVideoSize(size?: string): { resolution: string; ratio: string } {
  if (size) {
    for (const resolution of RESOLUTIONS) {
      const table = VIDEO_SIZE_MAP[resolution]
      for (const [ratio, key] of Object.entries(table)) {
        if (key === size) return { resolution, ratio }
      }
    }
  }
  return { resolution: '720P', ratio: '16:9' }
}

export function videoSizeFor(resolution: string, ratio: string): string {
  const mapped = VIDEO_SIZE_MAP[resolution as Resolution]?.[ratio]
  return mapped || VIDEO_SIZE_MAP['720P']['16:9']
}

export function listVideoResolutions(modelKey: string, model?: ModelConfig): string[] {
  const caps = model || resolveVideoCapabilities(modelKey)
  const fromResolutions = (caps.resolutions || []).map((item) => item.key).filter(Boolean)
  if (fromResolutions.length) {
    const known = RESOLUTIONS.filter((item) => fromResolutions.includes(item))
    const extra = fromResolutions.filter((item) => !RESOLUTIONS.includes(item as Resolution))
    return [...known, ...extra]
  }
  const fromSizes = new Set<Resolution>()
  for (const size of caps.sizes || []) {
    const parsed = parseVideoSize(size.key).resolution
    if (RESOLUTIONS.includes(parsed as Resolution)) fromSizes.add(parsed as Resolution)
  }
  if (fromSizes.size) return RESOLUTIONS.filter((item) => fromSizes.has(item))
  return ['720P']
}

export function listVideoAspectRatios(modelKey: string, model?: ModelConfig): string[] {
  const caps = model || resolveVideoCapabilities(modelKey)
  if (caps.ratios?.length) return caps.ratios.map((item) => item.key)
  if (caps.sizes?.length) return uniqueAspectRatios(caps.sizes)
  if (caps.supportsAspect === false) return []
  return [...ASPECT_RATIOS]
}

/** Same cap as backend `collect_video_refs` for HappyHorse. */
const VIDEO_REFERENCE_LIMIT = 3

/**
 * Image URLs `collectGenerateInputs` gathers for a video node: the first frame,
 * then the other attached reference images. An @mention only matters when it
 * points at one of those images; a text mention does not add a URL.
 */
/** Image URLs that `collect_video_refs` will actually send. Text mentions add nothing. */
export function listVideoRequestImages(
  firstFrameImage?: string,
  refImages?: readonly string[]
): string[] {
  const refs: string[] = []
  for (const item of [firstFrameImage, ...(refImages || [])]) {
    const url = (item || '').trim()
    if (!url || refs.includes(url)) continue
    refs.push(url)
    if (refs.length >= VIDEO_REFERENCE_LIMIT) break
  }
  return refs
}

export function countVideoRequestReferences(
  firstFrameImage?: string,
  refImages?: readonly string[]
): number {
  return listVideoRequestImages(firstFrameImage, refImages).length
}

export interface VideoRequestFields {
  ratio?: string
  resolution?: string
  size?: string
}

/**
 * Fields the video request should carry.
 * HappyHorse t2v includes `ratio`. Any reference image uses i2v and omits ratio
 * so the frame follows the first image. r2v is never selected.
 */
export function videoRequestParams(input: {
  model: string
  referenceCount: number
  ratio?: string
  resolution?: string
  size?: string
}): VideoRequestFields {
  const routed = routedVideoModelKey(input.model, input.referenceCount)
  const parsed = parseVideoSize(input.size)
  const resolution = input.resolution || parsed.resolution
  if (!routed.startsWith('happyhorse-')) {
    return { resolution, size: input.size }
  }
  if (videoReferenceModeDropsAspect(input.model, input.referenceCount)) {
    return { resolution, size: input.size }
  }
  const ratios = listVideoAspectRatios(routed)
  const preferred = (input.ratio || '').trim()
  const ratio = ratios.includes(preferred)
    ? preferred
    : ratios.includes(parsed.ratio)
      ? parsed.ratio
      : ratios[0] || '16:9'
  return { ratio, resolution, size: videoSizeFor(resolution, ratio) }
}

function keepsOwnVideoAspect(modelKey: string): boolean {
  return isSeedanceModel(modelKey) || isMiniMaxModel(modelKey) || isViduModel(modelKey)
}

/**
 * HappyHorse mode follows image URLs, not the stored id:
 * 0 → t2v (ratio), ≥1 → i2v (no ratio; aspect follows the first frame).
 * Extra references are ignored. r2v is never returned.
 * Seedance / MiniMax / Vidu keep their own model even when references are attached.
 */
export function routedVideoModelKey(modelKey: string, referenceCount: number): string {
  if (keepsOwnVideoAspect(modelKey)) return modelKey
  if (referenceCount >= 1) return 'happyhorse-1.1-i2v'
  return 'happyhorse-1.1-t2v'
}

/** Image URLs the HappyHorse request should carry. i2v keeps only the first frame. */
export function happyHorseRequestImages(modelKey: string, images: readonly string[]): string[] {
  const routed = routedVideoModelKey(modelKey, images.length)
  if (!routed.startsWith('happyhorse-')) return [...images]
  return routed.endsWith('i2v') ? images.slice(0, 1) : []
}

/** Hide the ratio control for HappyHorse whenever an image URL will be sent. */
export function videoReferenceModeDropsAspect(modelKey: string, referenceCount: number): boolean {
  if (referenceCount < 1) return false
  if (keepsOwnVideoAspect(modelKey)) return false
  return true
}

export function videoAspectSuppressedByReferences(
  modelKey: string,
  inputs: { firstFrameImage?: string; refImages?: readonly string[] }
): boolean {
  return videoReferenceModeDropsAspect(
    modelKey,
    countVideoRequestReferences(inputs.firstFrameImage, inputs.refImages)
  )
}

export function listImageSizes(modelKey: string, quality?: string, model?: ModelConfig): SizeOption[] {
  const caps = model || resolveImageCapabilities(modelKey)
  if (caps.getSizesByQuality) {
    return caps.getSizesByQuality(quality || caps.defaultParams?.quality || 'medium')
  }
  if (caps.sizes?.length) return caps.sizes
  return labeledSizes(['1024x1024'])
}

/** Video generation count. The bar always offers these three, defaulting to 1. */
export const VIDEO_QUANTITY_OPTIONS = [1, 2, 4] as const

export function normalizeVideoQuantity(value: unknown): number {
  const count = typeof value === 'number' ? value : Number(value)
  if (count === 2 || count === 4) return count
  return 1
}

export function listQuantityOptions(modelKey: string, model?: ModelConfig): number[] {
  const caps = model || resolveImageCapabilities(modelKey)
  const maxN = Math.max(1, Math.min(caps.maxN || 1, 4))
  return [1, 2, 4].filter((item) => item <= maxN)
}

export function listImageAspectRatios(modelKey: string, quality?: string, model?: ModelConfig): string[] {
  return uniqueAspectRatios(listImageSizes(modelKey, quality, model))
}

/**
 * wan2.6-t2i and wan2.6-image publish different size lists.
 * Attached reference images use the img2img catalog when that model is available,
 * so the dock only offers sizes the request will send.
 */
export function resolveImageRequestModel(
  modelKey: string,
  referenceCount: number,
  liveIds: readonly string[] = []
): string {
  if (referenceCount > 0 && modelKey === 'wan2.6-t2i') {
    if (liveIds.length === 0 || liveIds.includes('wan2.6-image')) return 'wan2.6-image'
  }
  return modelKey
}

export function imageSizeForRequest(
  modelKey: string,
  quality: string | undefined,
  size: string | undefined,
  ratio: string | undefined,
  model?: ModelConfig
): string {
  const sizes = listImageSizes(modelKey, quality, model)
  if (size && sizes.some((item) => item.key === size)) return size
  const wanted = (ratio || (size ? getSizeRatio(size) : '')).trim()
  const match = wanted ? sizes.find((item) => getSizeRatio(item.key) === wanted) : undefined
  return match?.key || sizes[0]?.key || size || '1024x1024'
}

export function formatParamStub(node: CustomNode): string {
  const size = typeof node.data.size === 'string' ? node.data.size : ''
  const resolution = typeof node.data.resolution === 'string' ? node.data.resolution : ''
  const duration = typeof node.data.duration === 'number' ? `${node.data.duration}s` : ''
  if (node.type === 'videoConfig') {
    return [size || resolution, duration].filter(Boolean).join(' · ')
  }
  const ratio = typeof node.data.ratio === 'string' ? node.data.ratio : size ? getSizeRatio(size) : ''
  return [ratio, size].filter(Boolean).slice(0, 1).join('')
}

export function applyModelDefaults(
  nodeType: string,
  modelKey: string,
  node?: CustomNode,
  liveIds: readonly string[] = [],
  model?: ModelConfig
): Partial<NodeData> {
  if (nodeType === 'videoConfig') {
    const nextKey = liveIds.length
      ? remapModelId(modelKey, liveIds, 'video')
      : remapVideoModel(modelKey)
    const caps = model || resolveVideoCapabilities(nextKey)
    let size = caps.defaultParams?.size || '1280*720'
    let resolution = (caps.defaultParams?.resolution || parseVideoSize(size).resolution) as string
    const { ratio } = parseVideoSize(size)
    const limited = listVideoResolutions(nextKey, caps)
    if (!limited.includes(resolution as Resolution)) {
      resolution = limited[0] || '720P'
      size = videoSizeFor(resolution, ratio)
    }
    const next: Partial<NodeData> = {
      model: nextKey,
      size,
      resolution,
      ratio,
      duration: caps.defaultParams?.duration || 5,
    }
    if (node && !node.data.isLabelCustomized && caps.label) {
      next.label = getShortLabelFromModel(caps.label)
    }
    return next
  }

  const caps = model || resolveImageCapabilities(modelKey)
  const size = caps.defaultParams?.size || '1024x1024'
  const next: Partial<NodeData> = {
    model: modelKey,
    quality: caps.defaultParams?.quality,
    size,
    ratio: getSizeRatio(size),
    n: caps.defaultParams?.n || 1,
  }
  if (node && !node.data.isLabelCustomized && caps.label) {
    next.label = getShortLabelFromModel(caps.label)
  }
  return next
}

export function applyImageRatio(
  modelKey: string,
  quality: string | undefined,
  ratio: string,
  model?: ModelConfig
): Partial<NodeData> | null {
  const sizes = listImageSizes(modelKey, quality, model)
  const matching = sizes.find((item) => getSizeRatio(item.key) === ratio)
  if (!matching) return null
  return { size: matching.key, ratio }
}

export function applyVideoResolution(
  modelKey: string,
  resolution: string,
  currentSize?: string,
  currentRatio?: string
): Partial<NodeData> {
  const parsed = parseVideoSize(currentSize)
  const ratio = currentRatio || parsed.ratio
  const writesSize =
    isT2VModel(modelKey) || modelKey.includes('r2v') || modelKey.toLowerCase().includes('happyhorse')
  if (!writesSize) return { resolution }
  return { size: videoSizeFor(resolution, ratio), resolution, ratio }
}

export function applyVideoRatio(resolution: string, ratio: string): Partial<NodeData> {
  return {
    size: videoSizeFor(resolution, ratio),
    resolution,
    ratio,
  }
}

export function coerceGenerateParams(
  node: CustomNode,
  liveIds: readonly string[] = [],
  model?: ModelConfig
): Partial<NodeData> | null {
  if (node.type === 'imageConfig') {
    const modelKey = typeof node.data.model === 'string' ? node.data.model : 'gpt-image-2'
    const quality = typeof node.data.quality === 'string' ? node.data.quality : undefined
    const caps = model || resolveImageCapabilities(modelKey)
    const sizes = listImageSizes(modelKey, quality, caps)
    if (!sizes.length) return null
    const patch: Partial<NodeData> = {}
    const currentSize = typeof node.data.size === 'string' ? node.data.size : ''
    if (sizes.some((item) => item.key === currentSize)) {
      const actual = getSizeRatio(currentSize)
      if (node.data.ratio !== actual) patch.ratio = actual
    } else {
      const currentRatio =
        typeof node.data.ratio === 'string' && node.data.ratio
          ? node.data.ratio
          : currentSize
            ? getSizeRatio(currentSize)
            : ''
      const matching = currentRatio
        ? sizes.find((item) => getSizeRatio(item.key) === currentRatio)
        : undefined
      const nextSize = matching?.key || sizes[0].key
      patch.size = nextSize
      patch.ratio = getSizeRatio(nextSize)
    }
    const maxN = Math.max(1, caps.maxN || 1)
    const quantity = typeof node.data.n === 'number' ? node.data.n : 1
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxN) {
      patch.n = Math.min(maxN, Math.max(1, quantity || 1))
    }
    return Object.keys(patch).length ? patch : null
  }

  if (node.type === 'videoConfig') {
    const raw = typeof node.data.model === 'string' ? node.data.model : undefined
    const modelKey = liveIds.length ? remapModelId(raw, liveIds, 'video') : remapVideoModel(raw)
    const caps = model || resolveVideoCapabilities(modelKey)
    const patch: Partial<NodeData> = {}
    if (liveIds.length && modelKey !== raw) patch.model = modelKey
    const available = listVideoResolutions(modelKey, caps)
    const parsed = parseVideoSize(typeof node.data.size === 'string' ? node.data.size : undefined)
    const currentResolution =
      (typeof node.data.resolution === 'string' && node.data.resolution) || parsed.resolution
    if (!available.includes(currentResolution as Resolution)) {
      const next = available[0] || '720P'
      patch.resolution = next
      patch.size = videoSizeFor(next, parsed.ratio)
      patch.ratio = parsed.ratio
    }
    const durs = caps.durs?.map((item) => item.key) || []
    if (durs.length && (typeof node.data.duration !== 'number' || !durs.includes(node.data.duration))) {
      patch.duration = durs[0]
    }
    if (typeof node.data.n === 'number' && !VIDEO_QUANTITY_OPTIONS.includes(node.data.n as 1 | 2 | 4)) {
      patch.n = normalizeVideoQuantity(node.data.n)
    }
    return Object.keys(patch).length ? patch : null
  }

  return null
}
