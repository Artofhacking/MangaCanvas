import { describe, expect, it } from 'vitest'
import type { ModelDTO } from '@/api/types'
import {
  AUDIO_MUSIC_EMPTY_MESSAGE,
  AUDIO_SFX_UNAVAILABLE_MESSAGE,
  AUDIO_TTS_EMPTY_MESSAGE,
  audioGenerateBlockedMessage,
  audioModelsForMode,
  buildCanvasAudioRequest,
  readAudioMode,
} from './audioMode'

function model(partial: Partial<ModelDTO> & Pick<ModelDTO, 'id' | 'name'>): ModelDTO {
  return {
    provider: 'test',
    modality: 'audio',
    isEnabled: true,
    ...partial,
  }
}

describe('audio mode catalog', () => {
  const speech = model({
    id: 'speech-2.8-hd',
    name: 'Speech 2.8 HD 配音',
    parameters: { task: 'tts' },
  })
  const turbo = model({ id: 'speech-2.8-turbo', name: 'Speech 2.8 Turbo 配音' })
  const music = model({
    id: 'music-3.0',
    name: 'Music 3.0 音乐',
    parameters: { task: 'music' },
  })
  const generic = model({ id: 'audio-generic', name: '通用音频' })

  it('defaults unknown modes to 配音', () => {
    expect(readAudioMode(undefined)).toBe('tts')
    expect(readAudioMode('music')).toBe('music')
    expect(readAudioMode('sfx')).toBe('sfx')
  })

  it('splits speech and music ids and never offers 音效', () => {
    expect(audioModelsForMode([speech, turbo, music, generic], 'tts').map((item) => item.id)).toEqual([
      'speech-2.8-hd',
      'speech-2.8-turbo',
    ])
    expect(audioModelsForMode([speech, music, generic], 'music').map((item) => item.id)).toEqual(['music-3.0'])
    expect(audioModelsForMode([speech, music, generic], 'sfx')).toEqual([])
    expect(audioModelsForMode([], 'tts')).toEqual([])
    expect(audioGenerateBlockedMessage('sfx', 2)).toBe(AUDIO_SFX_UNAVAILABLE_MESSAGE)
    expect(audioGenerateBlockedMessage('tts', 0)).toBe('当前没有可用的音频模型')
  })

  it('builds the live generations body for 配音 and 音乐', () => {
    expect(buildCanvasAudioRequest({
      mode: 'tts',
      model: 'speech-2.8-hd',
      prompt: '夜色里的一句旁白',
      voiceId: 'Chinese (Mandarin)_Lyrical_Voice',
    })).toEqual({
      ok: true,
      body: {
        model: 'speech-2.8-hd',
        text: '夜色里的一句旁白',
        voiceId: 'Chinese (Mandarin)_Lyrical_Voice',
      },
    })
    expect(buildCanvasAudioRequest({ mode: 'tts', model: 'speech-2.8-hd', prompt: '  ' })).toEqual({
      ok: false,
      message: AUDIO_TTS_EMPTY_MESSAGE,
    })
    expect(buildCanvasAudioRequest({
      mode: 'music',
      model: 'music-3.0',
      prompt: '安静的钢琴',
      lyrics: '星光落在屋顶',
    })).toEqual({
      ok: true,
      body: { model: 'music-3.0', prompt: '安静的钢琴', lyrics: '星光落在屋顶' },
    })
    expect(buildCanvasAudioRequest({
      mode: 'music',
      model: 'music-3.0',
      prompt: '安静的钢琴',
    })).toEqual({
      ok: true,
      body: { model: 'music-3.0', prompt: '安静的钢琴', lyricsOptimizer: true },
    })
    expect(buildCanvasAudioRequest({ mode: 'music', model: 'music-3.0', prompt: '' })).toEqual({
      ok: false,
      message: AUDIO_MUSIC_EMPTY_MESSAGE,
    })
    expect(buildCanvasAudioRequest({ mode: 'sfx', model: 'speech-2.8-hd', prompt: '雨声' })).toEqual({
      ok: false,
      message: AUDIO_SFX_UNAVAILABLE_MESSAGE,
    })
  })
})
