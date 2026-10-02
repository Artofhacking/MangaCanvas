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

function live(id: string, name: string, modality: 'image' | 'video' | 'audio', extras: Partial<ModelDTO> = {}): ModelDTO {
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

  it('shows live Seedance even if a static catalog row is enabled:false', () => {
    const liveIds = [
      'happyhorse-1.1-t2v',
      'doubao-seedance-2-0-260128',
      'doubao-seedance-2-0-fast-260128',
      'doubao-seedance-2-0-mini-260615',
      'doubao-seedance-2-5-260628',
    ]
    const picked = resolvePickerModels(
      VIDEO_MODELS.map((item) =>
        item.key.includes('seedance') ? { ...item, enabled: false } : item
      ),
      liveIds,
      false
    )
    expect(picked.map((item) => item.key)).toEqual(liveIds)
    expect(picked.map((item) => item.label)).toEqual([
      'HappyHorse 文生视频',
      'Seedance 2.0',
      'Seedance 2.0 Fast',
      'Seedance 2.0 Mini',
      'Seedance 2.5',
    ])
    const livePicked = liveModelsToPicker(
      liveIds.map((id) => {
        const row = VIDEO_MODELS.find((item) => item.key === id)
        return live(id, row?.label || id, 'video', { provider: 'baidu' })
      }),
      'video',
      false
    )
    expect(livePicked.map((item) => item.key)).toEqual(liveIds)
    expect(livePicked.map((item) => displayModelName(item.label))).toEqual([
      'HappyHorse',
      'Seedance 2.0',
      'Seedance 2.0 Fast',
      'Seedance 2.0 Mini',
      'Seedance 2.5',
    ])
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

    for (const id of ['happyhorse-1.1-t2v', 'happyhorse-1.1-i2v', 'happyhorse-1.1-r2v'] as const) {
      const horse = resolveVideoCapabilities(id)
      expect(horse.durs).toEqual([
        { label: '5秒', key: 5 },
        { label: '10秒', key: 10 },
        { label: '15秒', key: 15 },
      ])
    }
    expect(resolveVideoCapabilities('happyhorse-1.1-t2v').defaultParams?.size).toBe('1280*720')
  })

  it('maps HappyHorse live durations so the generate bar can show 15秒', () => {
    const fromApi = capabilitiesFromApi(
      live('happyhorse-1.1-i2v', 'HappyHorse 图生视频', 'video', {
        parameters: {
          resolutions: ['720P', '1080P'],
          durations: [5, 10, 15],
        },
        defaultParams: { resolution: '720P', duration: 5 },
      })
    )
    expect(fromApi.durs).toEqual([
      { label: '5秒', key: 5 },
      { label: '10秒', key: 10 },
      { label: '15秒', key: 15 },
    ])
  })

  it('keeps the static ratio catalog when a live row sends empty lists', () => {
    const picker = liveModelsToPicker(
      [
        live('happyhorse-1.1-t2v', 'HappyHorse 文生视频', 'video', {
          parameters: {
            ratios: [],
            sizes: [],
            resolutions: ['720P', '1080P'],
            durations: [5, 10, 15],
            supports_aspect: false,
          },
        }),
      ],
      'video',
      false
    )
    const horse = picker.find((item) => item.key === 'happyhorse-1.1-t2v')
    expect(horse?.ratios?.map((item) => item.key)).toEqual([
      '16:9',
      '9:16',
      '1:1',
      '4:3',
      '3:4',
      '4:5',
      '5:4',
      '9:21',
      '21:9',
    ])
    expect(horse?.supportsAspect).toBe(true)

    const imagePicker = liveModelsToPicker(
      [
        live('gpt-image-2', 'GPT Image 2 文生图', 'image', {
          parameters: { sizes: [], qualities: [{ label: '中', key: 'medium' }] },
        }),
      ],
      'image',
      false
    )
    expect(imagePicker[0].getSizesByQuality?.('medium').map((item) => item.key)).toContain('1536x864')
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
    expect(fromApi.sizes?.map((item) => item.label)).toEqual(['1:1'])
    expect(fromApi.getSizesByQuality?.('high')).toEqual([{ key: '2048x2048', label: '1:1' }])
    expect(fromApi.maxN).toBe(2)
    expect(fromApi.defaultParams?.quality).toBe('high')
  })

  it('labels live GPT Image sizes as ratios and leaves Wan pixel labels intact', () => {
    const gpt = capabilitiesFromApi(
      live('gpt-image-2.5-flare', 'GPT Image 2.5 Flare 文生图', 'image', {
        parameters: {
          sizes: ['1024x1024', '1536x864', '1792x768'],
        },
      })
    )
    expect(gpt.sizes).toEqual([
      { key: '1024x1024', label: '1:1' },
      { key: '1536x864', label: '16:9' },
      { key: '1792x768', label: '21:9' },
    ])
    expect(gpt.sizes?.every((item) => !item.label.includes('x') && !item.label.includes('*'))).toBe(true)

    const opaque = capabilitiesFromApi(
      live('vendor-opaque-id', 'GPT Image 2.5 Sunburst 文生图', 'image', {
        parameters: { sizes: [{ key: '864x1536', label: '864x1536' }] },
      })
    )
    expect(opaque.sizes).toEqual([{ key: '864x1536', label: '9:16' }])

    const wan = capabilitiesFromApi(
      live('wan2.7-image', '万相 2.7 文生图', 'image', {
        parameters: { sizes: ['1280*1280', '1696*960'] },
      })
    )
    expect(wan.sizes).toEqual([
      { key: '1280*1280', label: '1280*1280' },
      { key: '1696*960', label: '1696*960' },
    ])
    expect(wan.getSizesByQuality?.('standard')).toEqual([
      { key: '1280*1280', label: '1:1 (1280*1280)' },
      { key: '1696*960', label: '16:9 (1696*960)' },
    ])
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

  it('shows live audio models and keeps tts voices from the catalog', () => {
    const picker = liveModelsToPicker(
      [
        live('speech-2.8-hd', 'Speech 2.8 HD 配音', 'audio', {
          parameters: {
            task: 'tts',
            voices: [{ label: '抒情', key: 'Chinese (Mandarin)_Lyrical_Voice' }],
          },
          defaultParams: { voice_id: 'Chinese (Mandarin)_Lyrical_Voice' },
        }),
        live('music-3.0', 'Music 3.0 音乐', 'audio', {
          parameters: { task: 'music' },
        }),
      ],
      'audio',
      false
    )
    expect(picker.map((item) => item.key)).toEqual(['speech-2.8-hd', 'music-3.0'])
    expect(picker.map((item) => item.task)).toEqual(['tts', 'music'])
    expect(picker[0]?.type).toBe('audio')
    expect(picker[0]?.voices?.[0]?.key).toBe('Chinese (Mandarin)_Lyrical_Voice')
    expect(picker[0]?.defaultParams?.voiceId).toBe('Chinese (Mandarin)_Lyrical_Voice')
    expect(liveModelsToPicker([], 'audio', false)).toEqual([])
    expect(liveModelsToPicker([live('speech-2.8-hd', 'Speech 2.8 HD 配音', 'audio')], 'audio', true)).toEqual([])
    expect(remapModelId('music', ['music-3.0', 'speech-2.8-hd'], 'audio')).toBe('music-3.0')
  })

  it('maps seeddance / Seedance aliases onto catalog ids', () => {
    expect(LEGACY_MODEL_ALIASES.seeddance).toBe('doubao-seedance-2-0-260128')
    expect(
      remapModelId('seeddance', ['doubao-seedance-2-0-260128', 'happyhorse-1.1-t2v'], 'video')
    ).toBe('doubao-seedance-2-0-260128')
  })
})
