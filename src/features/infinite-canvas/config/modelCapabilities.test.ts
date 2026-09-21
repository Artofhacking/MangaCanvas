import { describe, expect, it } from 'vitest'
import type { ModelDTO } from '@/api/types'
import { IMAGE_MODELS, VIDEO_MODELS, resolvePickerModels } from './models'
import {
  LEGACY_MODEL_ALIASES,
  capabilitiesFromApi,
  liveModelsToPicker,
  remapModelId,
  resolveImageCapabilities,
  resolveVideoCapabilities,
} from './modelCapabilities'

function live(id: string, name: string, modality: 'image' | 'video', extras: Partial<ModelDTO> = {}): ModelDTO {
  return {
    id,
    name,
    provider: 'nexcor',
    modality,
    isEnabled: true,
    ...extras,
  }
}

describe('resolvePickerModels', () => {
  it('never dumps the static catalog when the API list is empty', () => {
    expect(resolvePickerModels(IMAGE_MODELS, [], false)).toEqual([])
    expect(resolvePickerModels(VIDEO_MODELS, [], true)).toEqual([])
    expect(liveModelsToPicker([], 'image', false)).toEqual([])
    expect(liveModelsToPicker([], 'video', true)).toEqual([])
  })

  it('only returns API-returned ids even when the capability map has more', () => {
    const picked = resolvePickerModels(IMAGE_MODELS, ['gpt-image-2', 'not-in-catalog'], false)
    expect(picked.map((item) => item.key)).toEqual(['gpt-image-2'])
    const livePicked = liveModelsToPicker(
      [live('gpt-image-2', 'GPT Image 2 文生图', 'image'), live('unknown-live', '未知现场模型', 'image')],
      'image',
      false
    )
    expect(livePicked.map((item) => item.key)).toEqual(['gpt-image-2', 'unknown-live'])
    expect(IMAGE_MODELS.some((item) => item.key === 'unknown-live')).toBe(false)
  })
})

describe('capability lookup by id', () => {
  it('reads GPT / Wan / HappyHorse options from the capability map', () => {
    const gpt = resolveImageCapabilities('gpt-image-2')
    expect(gpt.defaultParams?.size).toBe('1024x1024')
    expect(gpt.qualities?.map((item) => item.key)).toEqual(['low', 'medium', 'high'])
    expect(gpt.getSizesByQuality?.('medium').map((item) => item.key)).toEqual([
      '1024x1024',
      '1536x864',
      '864x1536',
      '1536x1152',
      '1152x1536',
      '1536x1024',
      '1024x1536',
      '1792x768',
    ])

    const wan = resolveImageCapabilities('wan2.7-image')
    expect(wan.defaultParams?.size).toBe('1280*1280')
    expect(wan.getSizesByQuality?.('standard').map((item) => item.key)).toContain('1696*960')

    const horse = resolveVideoCapabilities('happyhorse-1.1-t2v')
    expect(horse.durs?.map((item) => item.key)).toEqual([5, 10])
    expect(horse.defaultParams?.size).toBe('1280*720')
  })

  it('prefers structured parameters from the live API row', () => {
    const fromApi = capabilitiesFromApi(
      live('gpt-image-2', 'GPT Image 2 文生图', 'image', {
        parameters: {
          sizes: ['2048x2048'],
          qualities: [{ label: '高', key: 'high' }],
          max_n: 2,
        },
        defaultParams: { size: '2048x2048', quality: 'high' },
      })
    )
    expect(fromApi.sizes?.map((item) => item.key)).toEqual(['2048x2048'])
    expect(fromApi.maxN).toBe(2)
    expect(fromApi.defaultParams?.quality).toBe('high')
  })
})

describe('legacy node.model remapping', () => {
  it('maps spelling / naming variants onto the shared probe id space', () => {
    expect(LEGACY_MODEL_ALIASES['gpt-image-2.5flare']).toBe('gpt-image-2.5-flare')
    expect(remapModelId('gpt-image-2.5flare', ['gpt-image-2.5-flare', 'gpt-image-2'], 'image')).toBe(
      'gpt-image-2.5-flare'
    )
    expect(remapModelId('happyhorse-i2v', ['happyhorse-1.1-t2v', 'happyhorse-1.1-i2v'], 'video')).toBe(
      'happyhorse-1.1-i2v'
    )
    expect(remapModelId('hailuo-i2v', ['MiniMax-H3', 'happyhorse-1.1-t2v'], 'video')).toBe('MiniMax-H3')
  })

  it('does not invent a dead HappyHorse id when that model is not live', () => {
    expect(remapModelId('kf2v-old', ['MiniMax-H3'], 'video')).toBe('MiniMax-H3')
    expect(remapModelId('unknown-image', ['wan2.7-image'], 'image')).toBe('wan2.7-image')
  })

  it('keeps an exact live id, including display-named 海螺 rows', () => {
    expect(remapModelId('MiniMax-H3', ['MiniMax-H3'], 'video')).toBe('MiniMax-H3')
    const picker = liveModelsToPicker(
      [live('MiniMax-H3', '海螺 图生视频', 'video')],
      'video',
      false
    )
    expect(picker[0]).toMatchObject({ key: 'MiniMax-H3', label: '海螺 图生视频' })
  })
})
