import type { ModelDTO, ModelParameterSet } from '@/api/types'
import { useModelsStore } from '@/store/modelsStore'
import type { ModelConfig, SizeOption } from '../types'
import { labeledSizes } from '../utils/aspectRatio'
import { IMAGE_MODELS, VIDEO_MODELS, enabledModels, getImageModel, getVideoModel } from './models'

export const SAFE_IMAGE_SIZE = '1024x1024'
export const SAFE_VIDEO_SIZE = '1280*720'
export const SAFE_VIDEO_RESOLUTION = '720P'
export const SAFE_VIDEO_DURATION = 5

const warnedMissing = new Set<string>()

export function warnMissingCapabilities(modelId: string, detail?: string): void {
  if (warnedMissing.has(modelId)) return
  warnedMissing.add(modelId)
  console.warn(
    `[models] missing capabilities for "${modelId}"${detail ? `: ${detail}` : ''}; using safe defaults`
  )
}

/** Legacy node.model / UI keys → current probe catalog ids. Never invents a live model. */
export const LEGACY_MODEL_ALIASES: Record<string, string> = {
  happyhorse: 'happyhorse-1.1-t2v',
  'happyhorse-t2v': 'happyhorse-1.1-t2v',
  'happyhorse-i2v': 'happyhorse-1.1-i2v',
  'happyhorse-r2v': 'happyhorse-1.1-r2v',
  'happy-horse-1.1-t2v': 'happyhorse-1.1-t2v',
  'happy-horse-1.1-i2v': 'happyhorse-1.1-i2v',
  'happy-horse-1.1-r2v': 'happyhorse-1.1-r2v',
  hailuo: 'MiniMax-H3',
  'hailuo-i2v': 'MiniMax-H3',
  'minimax-hailuo': 'MiniMax-H3',
  'minimax-h3': 'MiniMax-H3',
  'minimax-h3-max': 'MiniMax-H3-Max',
  'gpt-image-2.5flare': 'gpt-image-2.5-flare',
  'gpt-image-2.5_flare': 'gpt-image-2.5-flare',
  'gpt-image-2-5-flare': 'gpt-image-2.5-flare',
  'gpt-image-2.5sunburst': 'gpt-image-2.5-sunburst',
  'gpt-image-2.5_sunburst': 'gpt-image-2.5-sunburst',
  'gpt-image-2-5-sunburst': 'gpt-image-2.5-sunburst',
  'wan2.7': 'wan2.7-image',
  'wanx2.7-image': 'wan2.7-image',
  'wan2.6': 'wan2.6-t2i',
}

function normalizeModelId(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, '-')
}

export function remapModelId(
  raw: string | undefined,
  liveIds: readonly string[] = [],
  modality: 'image' | 'video' = 'image'
): string {
  const name = (raw || '').trim()
  const live = [...liveIds]
  if (name && live.includes(name)) return name

  const aliased =
    (name && (LEGACY_MODEL_ALIASES[name] || LEGACY_MODEL_ALIASES[normalizeModelId(name)])) || ''
  if (aliased && (live.length === 0 || live.includes(aliased))) return aliased

  if (name && live.length) {
    const normalized = normalizeModelId(name)
    const exact = live.find((id) => normalizeModelId(id) === normalized)
    if (exact) return exact
  }

  if (modality === 'video' && live.length) {
    if (name.includes('i2v') || name.includes('kf2v') || name.includes('r2v')) {
      const preferred = name.includes('r2v')
        ? live.find((id) => id.includes('r2v'))
        : live.find((id) => id.includes('i2v'))
      if (preferred) return preferred
    }
    const t2v = live.find((id) => id.includes('t2v'))
    if (t2v) return t2v
    return live[0]
  }

  if (live.length) return live[0]
  return aliased || name
}

function asLabeledKeys(value: unknown): { label: string; key: string }[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string' && item) return { label: item, key: item }
      if (item && typeof item === 'object') {
        const row = item as { label?: unknown; key?: unknown; value?: unknown }
        const key = String(row.key ?? row.value ?? '')
        if (!key) return null
        return { label: String(row.label || key), key }
      }
      return null
    })
    .filter((item): item is { label: string; key: string } => Boolean(item))
}

function asDurationOptions(value: unknown): { label: string; key: number }[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'number' && Number.isFinite(item)) {
        return { label: `${item}秒`, key: item }
      }
      if (item && typeof item === 'object') {
        const row = item as { label?: unknown; key?: unknown; value?: unknown }
        const key = Number(row.key ?? row.value)
        if (!Number.isFinite(key)) return null
        return { label: String(row.label || `${key}秒`), key }
      }
      return null
    })
    .filter((item): item is { label: string; key: number } => Boolean(item))
}

export function isStructuredParameters(
  value: ModelDTO['parameters']
): value is ModelParameterSet {
  return Boolean(value) && !Array.isArray(value) && typeof value === 'object'
}

export function capabilitiesFromApi(model: ModelDTO): Partial<ModelConfig> {
  const params = isStructuredParameters(model.parameters) ? model.parameters : undefined
  if (!params && !model.defaultParams) return {}

  const sizes = asLabeledKeys(params?.sizes)
  const qualities = asLabeledKeys(params?.qualities)
  const resolutions = asLabeledKeys(params?.resolutions)
  const ratios = asLabeledKeys(params?.ratios)
  const durs = asDurationOptions(params?.durations)
  const maxN = Number(params?.maxN ?? params?.max_n)
  const defaultParams = model.defaultParams || {}

  const next: Partial<ModelConfig> = {
    key: model.id,
    label: model.name,
  }
  if (sizes.length) {
    next.sizes = sizes
    next.getSizesByQuality = (): SizeOption[] =>
      sizes[0].label.includes('(') ? sizes : labeledSizes(sizes.map((item) => item.key))
  }
  if (qualities.length) next.qualities = qualities
  if (resolutions.length) next.resolutions = resolutions
  if (ratios.length) next.ratios = ratios
  if (durs.length) next.durs = durs
  if (Number.isFinite(maxN) && maxN > 0) next.maxN = maxN
  if (params?.supportsAspect != null || params?.supports_aspect != null) {
    next.supportsAspect = Boolean(params.supportsAspect ?? params.supports_aspect)
  }
  if (Object.keys(defaultParams).length) {
    next.defaultParams = {
      size: typeof defaultParams.size === 'string' ? defaultParams.size : undefined,
      quality: typeof defaultParams.quality === 'string' ? defaultParams.quality : undefined,
      ratio: typeof defaultParams.ratio === 'string' ? defaultParams.ratio : undefined,
      duration: typeof defaultParams.duration === 'number' ? defaultParams.duration : undefined,
      resolution: typeof defaultParams.resolution === 'string' ? defaultParams.resolution : undefined,
      n: typeof defaultParams.n === 'number' ? defaultParams.n : undefined,
    }
  }
  return next
}

function mergeModelConfig(
  type: 'image' | 'video',
  live: ModelDTO | undefined,
  mapped: ModelConfig | undefined
): ModelConfig {
  const fromApi = live ? capabilitiesFromApi(live) : {}
  const id = live?.id || mapped?.key || ''
  const hasApiCaps = Boolean(
    fromApi.sizes || fromApi.qualities || fromApi.resolutions || fromApi.durs
  )
  if (!hasApiCaps && !mapped && id) {
    warnMissingCapabilities(id)
  }
  const sizes = fromApi.sizes || mapped?.sizes
  return {
    key: id,
    label: live?.name || mapped?.label || id,
    type,
    async: mapped?.async ?? true,
    qualities: fromApi.qualities || mapped?.qualities,
    sizes,
    resolutions: fromApi.resolutions || mapped?.resolutions,
    ratios: fromApi.ratios || mapped?.ratios,
    durs: fromApi.durs || mapped?.durs,
    maxN: fromApi.maxN ?? mapped?.maxN ?? (type === 'image' ? 4 : undefined),
    supportsAspect:
      fromApi.supportsAspect ??
      mapped?.supportsAspect ??
      (type === 'video' ? Boolean(fromApi.sizes || mapped?.sizes) : undefined),
    defaultParams: { ...mapped?.defaultParams, ...fromApi.defaultParams },
    getSizesByQuality:
      fromApi.getSizesByQuality ||
      mapped?.getSizesByQuality ||
      (sizes ? () => (sizes[0].label.includes('(') ? sizes : labeledSizes(sizes.map((item) => item.key))) : undefined),
  }
}

export function liveModelsToPicker(
  liveModels: readonly ModelDTO[],
  type: 'image' | 'video',
  loading: boolean
): ModelConfig[] {
  if (loading) return []
  return liveModels
    .filter((item) => item.id && item.isEnabled !== false)
    .map((item) =>
      mergeModelConfig(
        type,
        item,
        type === 'image' ? getImageModel(item.id) : getVideoModel(item.id)
      )
    )
}

/** Picker source is live API ids only. An empty live list never dumps the static catalog. */
export function resolvePickerModels<T extends { key: string; enabled?: boolean }>(
  catalog: T[],
  liveIds: readonly string[],
  loading: boolean
): T[] {
  if (loading || liveIds.length === 0) return []
  const set = new Set(liveIds)
  return enabledModels(catalog).filter((item) => set.has(item.key))
}

export function safeImageConfig(id = ''): ModelConfig {
  return {
    key: id,
    label: id || '图片模型',
    type: 'image',
    async: true,
    qualities: [{ label: '标准', key: 'medium' }],
    defaultParams: { size: SAFE_IMAGE_SIZE, quality: 'medium', n: 1 },
    maxN: 1,
    getSizesByQuality: () => labeledSizes([SAFE_IMAGE_SIZE]),
  }
}

export function safeVideoConfig(id = ''): ModelConfig {
  return {
    key: id,
    label: id || '视频模型',
    type: 'video',
    async: true,
    resolutions: [{ label: SAFE_VIDEO_RESOLUTION, key: SAFE_VIDEO_RESOLUTION }],
    durs: [{ label: `${SAFE_VIDEO_DURATION}秒`, key: SAFE_VIDEO_DURATION }],
    defaultParams: {
      size: SAFE_VIDEO_SIZE,
      resolution: SAFE_VIDEO_RESOLUTION,
      duration: SAFE_VIDEO_DURATION,
    },
    supportsAspect: false,
  }
}

export function resolveImageCapabilities(modelId: string): ModelConfig {
  const live = useModelsStore.getState().getModelById(modelId)
  const mapped = getImageModel(live?.id || modelId)
  if (live || mapped) return mergeModelConfig('image', live, mapped)
  warnMissingCapabilities(modelId)
  return { ...safeImageConfig(modelId) }
}

export function resolveVideoCapabilities(modelId: string): ModelConfig {
  const live = useModelsStore.getState().getModelById(modelId)
  const mapped = getVideoModel(live?.id || modelId)
  if (live || mapped) return mergeModelConfig('video', live, mapped)
  warnMissingCapabilities(modelId)
  return { ...safeVideoConfig(modelId) }
}

export function capabilityCatalog(): ModelConfig[] {
  return [...IMAGE_MODELS, ...VIDEO_MODELS]
}
