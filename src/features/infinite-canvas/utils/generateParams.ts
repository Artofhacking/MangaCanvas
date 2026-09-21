import { isT2VModel } from '@/api/aigc'
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

export const VIDEO_SIZE_MAP: Record<Resolution, Record<AspectRatio, string>> = {
  '720P': {
    '16:9': '1280*720',
    '9:16': '720*1280',
    '1:1': '960*960',
    '4:3': '1088*832',
    '3:4': '832*1088',
  },
  '1080P': {
    '16:9': '1920*1080',
    '9:16': '1080*1920',
    '1:1': '1440*1440',
    '4:3': '1632*1248',
    '3:4': '1248*1632',
  },
}

export function getShortLabelFromModel(modelLabel: string): string {
  const match = modelLabel.match(/[文图]生[图视频]+|关键帧生视频/)
  return match ? match[0] : '文生图'
}

export function parseVideoSize(size?: string): { resolution: Resolution; ratio: AspectRatio } {
  if (size) {
    for (const resolution of RESOLUTIONS) {
      for (const ratio of ASPECT_RATIOS) {
        if (VIDEO_SIZE_MAP[resolution][ratio] === size) {
          return { resolution, ratio }
        }
      }
    }
  }
  return { resolution: '720P', ratio: '16:9' }
}

export function videoSizeFor(resolution: string, ratio: string): string {
  const mapped = VIDEO_SIZE_MAP[resolution as Resolution]?.[ratio as AspectRatio]
  return mapped || VIDEO_SIZE_MAP['720P']['16:9']
}

export function listVideoResolutions(modelKey: string, model?: ModelConfig): Resolution[] {
  const caps = model || resolveVideoCapabilities(modelKey)
  const fromResolutions = (caps.resolutions || [])
    .map((item) => item.key)
    .filter((item): item is Resolution => RESOLUTIONS.includes(item as Resolution))
  if (fromResolutions.length) return fromResolutions
  const fromSizes = new Set<Resolution>()
  for (const size of caps.sizes || []) {
    fromSizes.add(parseVideoSize(size.key).resolution)
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

export function listImageSizes(modelKey: string, quality?: string, model?: ModelConfig): SizeOption[] {
  const caps = model || resolveImageCapabilities(modelKey)
  if (caps.getSizesByQuality) {
    return caps.getSizesByQuality(quality || caps.defaultParams?.quality || 'medium')
  }
  if (caps.sizes?.length) return caps.sizes
  return labeledSizes(['1024x1024'])
}

export function listQuantityOptions(modelKey: string, model?: ModelConfig): number[] {
  const caps = model || resolveImageCapabilities(modelKey)
  const maxN = Math.max(1, Math.min(caps.maxN || 1, 4))
  return [1, 2, 4].filter((item) => item <= maxN)
}

export function listImageAspectRatios(modelKey: string, quality?: string, model?: ModelConfig): string[] {
  return uniqueAspectRatios(listImageSizes(modelKey, quality, model))
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

export function applyVideoResolution(modelKey: string, resolution: string, currentSize?: string): Partial<NodeData> {
  const { ratio } = parseVideoSize(currentSize)
  const next = isT2VModel(modelKey)
    ? { size: videoSizeFor(resolution, ratio), resolution, ratio }
    : { resolution }
  return next
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
    return Object.keys(patch).length ? patch : null
  }

  return null
}
