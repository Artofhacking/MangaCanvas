import { describe, expect, it } from 'vitest'
import {
  applyAspectRatio,
  applyClarityTier,
  applyQualityTier,
  availableClarities,
  availableRatios,
  buildImageGenerateOptions,
  clampGenerateSettings,
  clarityFromSize,
  formatSettingsCapsule,
  isClaritySupported,
  isQualitySupported,
  isRatioSupported,
  resolveApiQuality,
  resolveGenerateSize,
  sizeForRatio,
} from './generateSettings'

describe('formatSettingsCapsule', () => {
  it('renders Lib-style summary text', () => {
    expect(
      formatSettingsCapsule({
        aspectRatio: '3:4',
        quality: 'standard',
        clarity: '1k',
        quantity: 2,
      })
    ).toBe('3:4 · 标准 · 1K · 2张')
  })
})

describe('clarityFromSize', () => {
  it('buckets long-edge into 1K / 2K / 4K', () => {
    expect(clarityFromSize('1024x1024')).toBe('1k')
    expect(clarityFromSize('1280*1280')).toBe('1k')
    expect(clarityFromSize('1536x1024')).toBe('2k')
    expect(clarityFromSize('1024x1536')).toBe('2k')
    expect(clarityFromSize('1696*960')).toBe('2k')
    expect(clarityFromSize('2048x2048')).toBe('4k')
  })
})

describe('GPT Image 2 support', () => {
  it('maps 低 / 标准 / 高 and disables 超高 / 极致', () => {
    expect(isQualitySupported('gpt-image-2', 'low')).toBe(true)
    expect(isQualitySupported('gpt-image-2', 'standard')).toBe(true)
    expect(isQualitySupported('gpt-image-2', 'high')).toBe(true)
    expect(isQualitySupported('gpt-image-2', 'ultra')).toBe(false)
    expect(isQualitySupported('gpt-image-2', 'max')).toBe(false)
    expect(resolveApiQuality('gpt-image-2', 'standard')).toBe('medium')
    expect(resolveApiQuality('gpt-image-2', 'low')).toBe('low')
  })

  it('only exposes catalog ratios, not a guessed 3:4 / 16:9', () => {
    expect(availableRatios('gpt-image-2', 'standard')).toEqual(['1:1', '3:2', '2:3'])
    expect(isRatioSupported('gpt-image-2', 'standard', '3:4')).toBe(false)
    expect(isRatioSupported('gpt-image-2', 'standard', '16:9')).toBe(false)
    expect(isRatioSupported('gpt-image-2', 'standard', '1:1')).toBe(true)
  })

  it('maps 1:1 to 1K and 3:2 / 2:3 to 2K', () => {
    expect(availableClarities('gpt-image-2', 'standard', '1:1')).toEqual(['1k'])
    expect(availableClarities('gpt-image-2', 'standard', '3:2')).toEqual(['2k'])
    expect(resolveGenerateSize('gpt-image-2', 'standard', '1:1', '1k')).toEqual({
      size: '1024x1024',
      quality: 'medium',
    })
    expect(resolveGenerateSize('gpt-image-2', 'standard', '3:2', '2k')).toEqual({
      size: '1536x1024',
      quality: 'medium',
    })
    expect(resolveGenerateSize('gpt-image-2', 'standard', '3:2', '1k')).toBeNull()
  })
})

describe('万相 2.7 support', () => {
  it('only enables 标准画质', () => {
    expect(isQualitySupported('wan2.7-image', 'standard')).toBe(true)
    expect(isQualitySupported('wan2.7-image', 'low')).toBe(false)
    expect(isQualitySupported('wan2.7-image', 'high')).toBe(false)
    expect(resolveApiQuality('wan2.7-image', 'standard')).toBe('standard')
  })

  it('supports 3:4 at 1K and 16:9 at 2K from catalog sizes', () => {
    expect(isRatioSupported('wan2.7-image', 'standard', '3:4')).toBe(true)
    expect(isClaritySupported('wan2.7-image', 'standard', '3:4', '1k')).toBe(true)
    expect(resolveGenerateSize('wan2.7-image', 'standard', '3:4', '1k')).toEqual({
      size: '1104*1472',
      quality: 'standard',
    })
    expect(resolveGenerateSize('wan2.7-image', 'standard', '16:9', '2k')).toEqual({
      size: '1696*960',
      quality: 'standard',
    })
    expect(isClaritySupported('wan2.7-image', 'standard', '16:9', '1k')).toBe(false)
    expect(isClaritySupported('wan2.7-image', 'standard', '16:9', '4k')).toBe(false)
  })
})

describe('unknown model fallback', () => {
  it('keeps 标准 + 1K and computes a ratio size instead of inventing 2K/4K', () => {
    expect(isQualitySupported('jimeng-3', 'standard')).toBe(true)
    expect(isQualitySupported('jimeng-3', 'high')).toBe(false)
    expect(isRatioSupported('jimeng-3', 'standard', '3:4')).toBe(true)
    expect(isClaritySupported('jimeng-3', 'standard', '3:4', '1k')).toBe(true)
    expect(isClaritySupported('jimeng-3', 'standard', '3:4', '2k')).toBe(false)
    expect(resolveGenerateSize('jimeng-3', 'standard', '3:4', '1k')).toEqual({
      size: sizeForRatio('3:4', 1024),
      quality: 'medium',
    })
  })
})

describe('apply + clamp', () => {
  it('rejects unsupported quality with a toast message and no mutation', () => {
    const current = { aspectRatio: '1:1', quality: 'standard' as const, clarity: '1k' as const, quantity: 1 }
    expect(applyQualityTier('wan2.7-image', current, 'high')).toEqual({
      settings: current,
      ok: false,
      message: '当前模型不支持「高」画质',
    })
  })

  it('rejects unsupported ratio and clamps GPT 3:4 down to 1:1', () => {
    const current = { aspectRatio: '3:4', quality: 'standard' as const, clarity: '1k' as const, quantity: 2 }
    expect(applyAspectRatio('gpt-image-2', current, '3:4').ok).toBe(false)
    const clamped = clampGenerateSettings('gpt-image-2', current)
    expect(clamped.changed).toBe(true)
    expect(clamped.settings.aspectRatio).toBe('1:1')
    expect(clamped.settings.quantity).toBe(2)
  })

  it('switches clarity when the new ratio only has 2K', () => {
    const current = { aspectRatio: '1:1', quality: 'standard' as const, clarity: '1k' as const, quantity: 1 }
    const next = applyAspectRatio('gpt-image-2', current, '3:2')
    expect(next.ok).toBe(true)
    expect(next.settings).toEqual({
      aspectRatio: '3:2',
      quality: 'standard',
      clarity: '2k',
      quantity: 1,
    })
    expect(next.message).toContain('2K')
  })

  it('rejects 4K on current catalogs', () => {
    const current = { aspectRatio: '1:1', quality: 'standard' as const, clarity: '1k' as const, quantity: 1 }
    expect(applyClarityTier('gpt-image-2', current, '4k').ok).toBe(false)
  })
})

describe('buildImageGenerateOptions', () => {
  it('passes quantity through as n and maps quality + size', () => {
    expect(
      buildImageGenerateOptions({
        model: 'wan2.7-image',
        prompt: 'a lantern',
        settings: { aspectRatio: '3:4', quality: 'standard', clarity: '1k', quantity: 2 },
      })
    ).toEqual({
      model: 'wan2.7-image',
      prompt: 'a lantern',
      size: '1104*1472',
      quality: 'standard',
      n: 2,
      images: undefined,
    })
  })

  it('attaches reference images for wan2.6-image', () => {
    const result = buildImageGenerateOptions({
      model: 'wan2.6-image',
      prompt: 'refine',
      settings: { aspectRatio: '1:1', quality: 'standard', clarity: '1k', quantity: 1 },
      referenceImages: ['https://example.com/ref.png'],
    })
    expect(result).toMatchObject({
      n: 1,
      images: ['https://example.com/ref.png'],
    })
  })

  it('attaches reference images for GPT Image instead of stripping them', () => {
    const result = buildImageGenerateOptions({
      model: 'gpt-image-2',
      prompt: '将图片做成线稿图，保证原图的细节完整性。',
      settings: { aspectRatio: '1:1', quality: 'standard', clarity: '1k', quantity: 1 },
      referenceImages: ['https://example.com/city.png'],
    })
    expect(result).toMatchObject({
      model: 'gpt-image-2',
      images: ['https://example.com/city.png'],
    })
  })

  it('errors instead of silently dropping refs on text-only models', () => {
    expect(
      buildImageGenerateOptions({
        model: 'wan2.7-image',
        prompt: 'lineart',
        settings: { aspectRatio: '1:1', quality: 'standard', clarity: '1k', quantity: 1 },
        referenceImages: ['https://example.com/city.png'],
      })
    ).toEqual({ error: '当前模型不支持参考图，请改用万相 2.6 图生图' })
  })
})
