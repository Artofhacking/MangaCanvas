import { resolveImageCapabilities } from '@/features/infinite-canvas/config/modelCapabilities'
import { listImageSizes, listQuantityOptions } from '@/features/infinite-canvas/utils/generateParams'
import { getSizeRatio, parseSizeDimensions, uniqueAspectRatios } from '@/features/infinite-canvas/utils/aspectRatio'
import { resolveImageReferences } from '@/api/aigc'
import type { ImageGenerateOptions } from '@/api/aigc/types'

export const QUALITY_TIERS = [
  { id: 'low', label: '低', apiKeys: ['low'] },
  { id: 'standard', label: '标准', apiKeys: ['medium', 'standard'] },
  { id: 'high', label: '高', apiKeys: ['high'] },
  { id: 'ultra', label: '超高', apiKeys: ['ultra', 'hd'] },
  { id: 'max', label: '极致', apiKeys: ['max', 'highest'] },
] as const

export type QualityTier = (typeof QUALITY_TIERS)[number]['id']

export const CLARITY_TIERS = [
  { id: '1k', label: '1K' },
  { id: '2k', label: '2K' },
  { id: '4k', label: '4K' },
] as const

export type ClarityTier = (typeof CLARITY_TIERS)[number]['id']

/** Lib-style ratio tiles. Unsupported ones are greyed out per model. */
export const GENERATE_ASPECT_RATIOS = [
  '1:1',
  '1:2',
  '2:1',
  '9:16',
  '16:9',
  '3:4',
  '4:3',
  '3:2',
  '2:3',
  '5:4',
  '4:5',
  '21:9',
  '9:21',
] as const

export type GenerateAspectRatio = (typeof GENERATE_ASPECT_RATIOS)[number]

export const QUANTITY_OPTIONS = [1, 2, 4] as const

export interface GenerateSettings {
  aspectRatio: string
  quality: QualityTier
  clarity: ClarityTier
  quantity: number
}

export const DEFAULT_GENERATE_SETTINGS: GenerateSettings = {
  aspectRatio: '1:1',
  quality: 'standard',
  clarity: '1k',
  quantity: 1,
}

export interface ImageGenerationConfig extends GenerateSettings {
  model: string
  prompt: string
  referenceImages: string[]
}

export const defaultImageGenerationConfig = (
  overrides?: Partial<ImageGenerationConfig>
): ImageGenerationConfig => ({
  model: '',
  prompt: '',
  referenceImages: [],
  ...DEFAULT_GENERATE_SETTINGS,
  ...overrides,
})

export function qualityTierLabel(tier: QualityTier): string {
  return QUALITY_TIERS.find((item) => item.id === tier)?.label ?? '标准'
}

export function formatSettingsCapsule(settings: GenerateSettings): string {
  return `${settings.aspectRatio} · ${qualityTierLabel(settings.quality)} · ${settings.clarity.toUpperCase()} · ${settings.quantity}张`
}

export function clarityFromSize(size: string): ClarityTier {
  const dims = parseSizeDimensions(size)
  const maxEdge = dims ? Math.max(dims.width, dims.height) : 1024
  if (maxEdge >= 2048) return '4k'
  if (maxEdge >= 1536) return '2k'
  return '1k'
}

export function sizeForRatio(ratio: string, longEdge: number): string {
  const parts = String(ratio || '1:1').split(':').map((part) => Number(part.trim()))
  const width = parts[0] && parts[0] > 0 ? parts[0] : 1
  const height = parts[1] && parts[1] > 0 ? parts[1] : 1
  if (width >= height) {
    return `${longEdge}x${Math.max(1, Math.round((longEdge * height) / width))}`
  }
  return `${Math.max(1, Math.round((longEdge * width) / height))}x${longEdge}`
}

export function resolveApiQuality(model: string, tier: QualityTier): string | null {
  const catalog = resolveImageCapabilities(model)
  const keys = QUALITY_TIERS.find((item) => item.id === tier)?.apiKeys ?? []
  const available = catalog.qualities?.map((item) => item.key) ?? []
  if (available.length > 0) {
    return keys.find((key) => available.includes(key)) ?? null
  }
  return tier === 'standard' ? 'medium' : null
}

export function listSettingsSizes(model: string, quality: QualityTier) {
  const apiQuality = resolveApiQuality(model, quality) ?? resolveApiQuality(model, 'standard') ?? 'medium'
  return listImageSizes(model, apiQuality)
}

export function isQualitySupported(model: string, tier: QualityTier): boolean {
  return resolveApiQuality(model, tier) != null
}

export function isRatioSupported(model: string, quality: QualityTier, ratio: string): boolean {
  return listSettingsSizes(model, quality).some((item) => getSizeRatio(item.key) === ratio)
}

export function isClaritySupported(
  model: string,
  quality: QualityTier,
  ratio: string,
  clarity: ClarityTier
): boolean {
  return listSettingsSizes(model, quality).some(
    (item) => getSizeRatio(item.key) === ratio && clarityFromSize(item.key) === clarity
  )
}

export function availableClarities(model: string, quality: QualityTier, ratio: string): ClarityTier[] {
  const seen = new Set<ClarityTier>()
  for (const item of listSettingsSizes(model, quality)) {
    if (getSizeRatio(item.key) !== ratio) continue
    seen.add(clarityFromSize(item.key))
  }
  return CLARITY_TIERS.map((item) => item.id).filter((id) => seen.has(id))
}

export function availableRatios(model: string, quality: QualityTier): string[] {
  const seen = new Set(uniqueAspectRatios(listSettingsSizes(model, quality)))
  const ordered = GENERATE_ASPECT_RATIOS.filter((ratio) => seen.has(ratio))
  return ordered.length ? ordered : [...seen]
}

export function resolveGenerateSize(
  model: string,
  quality: QualityTier,
  ratio: string,
  clarity: ClarityTier
): { size: string; quality: string } | null {
  const apiQuality = resolveApiQuality(model, quality)
  if (!apiQuality) return null
  const match = listSettingsSizes(model, quality).find(
    (item) => getSizeRatio(item.key) === ratio && clarityFromSize(item.key) === clarity
  )
  if (!match) return null
  return { size: match.key, quality: apiQuality }
}

export function firstSupportedSettings(
  model: string,
  preferred: Partial<GenerateSettings> = {}
): GenerateSettings {
  const quality =
    preferred.quality && isQualitySupported(model, preferred.quality)
      ? preferred.quality
      : QUALITY_TIERS.find((item) => isQualitySupported(model, item.id))?.id ?? 'standard'
  const ratios = availableRatios(model, quality)
  const aspectRatio =
    preferred.aspectRatio && ratios.includes(preferred.aspectRatio)
      ? preferred.aspectRatio
      : ratios[0] ?? '1:1'
  const clarities = availableClarities(model, quality, aspectRatio)
  const clarity =
    preferred.clarity && clarities.includes(preferred.clarity) ? preferred.clarity : clarities[0] ?? '1k'
  const allowed = listQuantityOptions(model)
  const quantity = allowed.includes(preferred.quantity as number)
    ? (preferred.quantity as number)
    : allowed[0] ?? 1
  return { quality, aspectRatio, clarity, quantity }
}

export function clampGenerateSettings(
  model: string,
  settings: GenerateSettings
): { settings: GenerateSettings; changed: boolean; message?: string } {
  const next = firstSupportedSettings(model, settings)
  const changed =
    next.quality !== settings.quality ||
    next.aspectRatio !== settings.aspectRatio ||
    next.clarity !== settings.clarity
  if (!changed) return { settings: { ...settings, quantity: next.quantity }, changed: false }
  const parts: string[] = []
  if (next.quality !== settings.quality) parts.push(`画质已调整为「${qualityTierLabel(next.quality)}」`)
  if (next.aspectRatio !== settings.aspectRatio) parts.push(`比例已调整为 ${next.aspectRatio}`)
  if (next.clarity !== settings.clarity) parts.push(`清晰度已调整为 ${next.clarity.toUpperCase()}`)
  return { settings: next, changed: true, message: `${parts.join('，')}（当前模型可用范围）` }
}

export function applyQualityTier(
  model: string,
  settings: GenerateSettings,
  quality: QualityTier
): { settings: GenerateSettings; ok: boolean; message?: string } {
  if (!isQualitySupported(model, quality)) {
    return { settings, ok: false, message: `当前模型不支持「${qualityTierLabel(quality)}」画质` }
  }
  return { settings: firstSupportedSettings(model, { ...settings, quality }), ok: true }
}

export function applyAspectRatio(
  model: string,
  settings: GenerateSettings,
  aspectRatio: string
): { settings: GenerateSettings; ok: boolean; message?: string } {
  if (!isRatioSupported(model, settings.quality, aspectRatio)) {
    return { settings, ok: false, message: `当前模型不支持 ${aspectRatio} 比例` }
  }
  const next = firstSupportedSettings(model, { ...settings, aspectRatio })
  const message =
    next.clarity !== settings.clarity
      ? `已切换到 ${next.clarity.toUpperCase()}（该比例可用清晰度）`
      : undefined
  return { settings: next, ok: true, message }
}

export function applyClarityTier(
  model: string,
  settings: GenerateSettings,
  clarity: ClarityTier
): { settings: GenerateSettings; ok: boolean; message?: string } {
  if (!isClaritySupported(model, settings.quality, settings.aspectRatio, clarity)) {
    return { settings, ok: false, message: `当前比例不支持 ${clarity.toUpperCase()} 清晰度` }
  }
  return { settings: { ...settings, clarity }, ok: true }
}

export function applyQuantity(
  settings: GenerateSettings,
  quantity: number,
  model?: string
): { settings: GenerateSettings; ok: boolean; message?: string } {
  const allowed = model ? listQuantityOptions(model) : [...QUANTITY_OPTIONS]
  if (!allowed.includes(quantity)) {
    return { settings, ok: false, message: `生成数量仅支持 ${allowed.join('/')} 张` }
  }
  return { settings: { ...settings, quantity }, ok: true }
}

export function buildImageGenerateOptions(input: {
  model: string
  prompt: string
  settings: GenerateSettings
  referenceImages?: string[]
}): ImageGenerateOptions | { error: string } {
  const resolved = resolveGenerateSize(
    input.model,
    input.settings.quality,
    input.settings.aspectRatio,
    input.settings.clarity
  )
  if (!resolved) {
    return { error: '当前模型不支持所选画质 / 清晰度 / 比例组合' }
  }
  const resolvedRefs = resolveImageReferences(input.model, input.referenceImages)
  if (resolvedRefs.error) {
    return { error: resolvedRefs.error }
  }
  return {
    model: input.model,
    prompt: input.prompt,
    size: resolved.size,
    quality: resolved.quality,
    n: input.settings.quantity,
    images: resolvedRefs.images,
  }
}

/** Compatibility map for older 1K-only callers. Prefer resolveGenerateSize. */
export const aspectToSize: Record<string, string> = Object.fromEntries(
  GENERATE_ASPECT_RATIOS.map((ratio) => [ratio, sizeForRatio(ratio, 1024)])
)
