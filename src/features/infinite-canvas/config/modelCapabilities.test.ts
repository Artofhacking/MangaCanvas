import { describe, expect, it } from 'vitest'
import type { ModelDTO } from '@/api/types'
import { displayModelName } from '@/lib/displayModelName'
import { IMAGE_MODELS, VIDEO_MODELS, resolvePickerModels } from './models'
import {
  LEGACY_MODEL_ALIASES,
  capabilitiesFromApi,
  collapseVideoPickerModels,
  findVideoPickerModel,
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

describe('video picker family collapse', () => {
  it('collapses HappyHorse t2v/i2v/r2v to one distinct label', () => {
    const picker = liveModelsToPicker(
      [
        live('happyhorse-1.1-t2v', 'HappyHorse 文生视频', 'video'),
        live('happyhorse-1.1-i2v', 'HappyHorse 图生视频', 'video'),
        live('happyhorse-1.1-r2v', 'HappyHorse 参考图生视频', 'video'),
        live('doubao-seedance-2-0-260128', 'Seedance 2.0', 'video'),
        live('doubao-seedance-2-0-fast-260128', 'Seedance 2.0 Fast', 'video'),
      ],
      'video',
      false
    )
    const labels = picker.map((item) => displayModelName(item.label))
    expect(labels).toEqual(['HappyHorse', 'Seedance 2.0', 'Seedance 2.0 Fast'])
    expect(new Set(labels).size).toBe(labels.length)
    expect(picker.map((item) => item.key)).toEqual([
      'happyhorse-1.1-t2v',
      'doubao-seedance-2-0-260128',
      'doubao-seedance-2-0-fast-260128',
    ])
  })

  it('treats a stored i2v node as the collapsed HappyHorse row', () => {
    const picker = collapseVideoPickerModels([
      resolveVideoCapabilities('happyhorse-1.1-t2v'),
      resolveVideoCapabilities('happyhorse-1.1-i2v'),
    ])
    expect(findVideoPickerModel(picker, 'happyhorse-1.1-i2v')?.key).toBe('happyhorse-1.1-t2v')
    expect(findVideoPickerModel(picker, 'happyhorse-1.1-r2v')?.key).toBe('happyhorse-1.1-t2v')
  })

  it('maps seeddance / Seedance aliases onto catalog ids', () => {
    expect(LEGACY_MODEL_ALIASES.seeddance).toBe('doubao-seedance-2-0-260128')
    expect(
      remapModelId('seeddance', ['doubao-seedance-2-0-260128', 'happyhorse-1.1-t2v'], 'video')
    ).toBe('doubao-seedance-2-0-260128')
  })
})
