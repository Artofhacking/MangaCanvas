import { isMiniMaxModel, isSeedanceModel, isT2VModel } from '@/api/aigc'
import { IMAGE_MODELS, VIDEO_MODELS, remapVideoModel } from '../config/models'
import type { CustomNode, NodeData, SizeOption } from '../types'

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

const SIZE_RATIO_MAP: Record<string, string> = {
  '1280*1280': '1:1',
  '1024*1024': '1:1',
  '1024x1024': '1:1',
  '1440*1440': '1:1',
  '960*960': '1:1',
  '1696*960': '16:9',
  '1280*720': '16:9',
  '1920*1080': '16:9',
  '1536x1024': '3:2',
  '960*1696': '9:16',
  '720*1280': '9:16',
  '1080*1920': '9:16',
  '1024x1536': '2:3',
  '1472*1104': '4:3',
  '1280*960': '4:3',
  '1088*832': '4:3',
  '1632*1248': '4:3',
  '1104*1472': '3:4',
  '960*1280': '3:4',
  '832*1088': '3:4',
  '1248*1632': '3:4',
  '1200*800': '3:2',
  '800*1200': '2:3',
  '1344*576': '21:9',
}

export function getSizeRatio(size: string): string {
  return SIZE_RATIO_MAP[size] || '1:1'
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

export function listVideoResolutions(modelKey: string): Resolution[] {
  if (isSeedanceModel(modelKey) && (modelKey.includes('fast') || modelKey.includes('mini'))) {
    return ['720P']
  }
  if (isMiniMaxModel(modelKey) && /h3-max/i.test(modelKey)) {
    return ['720P']
  }
  return ['1080P', '720P']
}

export function listImageSizes(modelKey: string, quality?: string): SizeOption[] {
  const model = IMAGE_MODELS.find((item) => item.key === modelKey)
  if (!model) return []
  if (model.getSizesByQuality) {
    return model.getSizesByQuality(quality || model.defaultParams?.quality || 'medium')
  }
  return model.sizes || []
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

export function applyModelDefaults(nodeType: string, modelKey: string, node?: CustomNode): Partial<NodeData> {
  if (nodeType === 'videoConfig') {
    const nextKey = remapVideoModel(modelKey)
    const model = VIDEO_MODELS.find((item) => item.key === nextKey)
    let size = model?.defaultParams?.size || '1280*720'
    let resolution = (model?.defaultParams?.resolution || parseVideoSize(size).resolution) as string
    const { ratio } = parseVideoSize(size)
    const limited = listVideoResolutions(nextKey)
    if (!limited.includes(resolution as Resolution)) {
      resolution = limited[0] || '720P'
      size = videoSizeFor(resolution, ratio)
    }
    return {
      model: nextKey,
      size,
      resolution,
      ratio,
      duration: model?.defaultParams?.duration || 5,
    }
  }

  const model = IMAGE_MODELS.find((item) => item.key === modelKey)
  const size = model?.defaultParams?.size || '1024x1024'
  const next: Partial<NodeData> = {
    model: modelKey,
    quality: model?.defaultParams?.quality,
    size,
    ratio: getSizeRatio(size),
  }
  if (node && !node.data.isLabelCustomized && model?.label) {
    next.label = getShortLabelFromModel(model.label)
  }
  return next
}

export function applyImageRatio(modelKey: string, quality: string | undefined, ratio: string): Partial<NodeData> | null {
  const sizes = listImageSizes(modelKey, quality)
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

export function coerceGenerateParams(node: CustomNode): Partial<NodeData> | null {
  if (node.type === 'imageConfig') {
    const modelKey = typeof node.data.model === 'string' ? node.data.model : 'gpt-image-2'
    const quality = typeof node.data.quality === 'string' ? node.data.quality : undefined
    const sizes = listImageSizes(modelKey, quality)
    if (!sizes.length) return null
    const currentSize = typeof node.data.size === 'string' ? node.data.size : ''
    if (sizes.some((item) => item.key === currentSize)) {
      if (!node.data.ratio) return { ratio: getSizeRatio(currentSize) }
      return null
    }
    const nextSize = sizes[0].key
    return { size: nextSize, ratio: getSizeRatio(nextSize) }
  }

  if (node.type === 'videoConfig') {
    const modelKey = remapVideoModel(typeof node.data.model === 'string' ? node.data.model : undefined)
    const model = VIDEO_MODELS.find((item) => item.key === modelKey)
    const patch: Partial<NodeData> = {}
    const available = listVideoResolutions(modelKey)
    const parsed = parseVideoSize(typeof node.data.size === 'string' ? node.data.size : undefined)
    const currentResolution =
      (typeof node.data.resolution === 'string' && node.data.resolution) || parsed.resolution
    if (!available.includes(currentResolution as Resolution)) {
      const next = available[0] || '720P'
      patch.resolution = next
      patch.size = videoSizeFor(next, parsed.ratio)
      patch.ratio = parsed.ratio
    }
    const durs = model?.durs?.map((item) => item.key) || []
    if (durs.length && (typeof node.data.duration !== 'number' || !durs.includes(node.data.duration))) {
      patch.duration = durs[0]
    }
    return Object.keys(patch).length ? patch : null
  }

  return null
}
