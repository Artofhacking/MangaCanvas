import { describe, expect, it } from 'vitest'
import { MINIMAX_MUSIC_TIP, MINIMAX_TTS_TIP, audioModelTip } from './audioModelTip'

describe('audioModelTip', () => {
  it('matches MiniMax speech and music rows', () => {
    expect(audioModelTip('speech-2.8-hd', 'Speech 2.8 HD 配音')).toBe(MINIMAX_TTS_TIP)
    expect(audioModelTip('speech-2.8-turbo', 'Speech 2.8 Turbo 配音')).toBe(MINIMAX_TTS_TIP)
    expect(audioModelTip('SPEECH_2.8_HD', '配音')).toBe(MINIMAX_TTS_TIP)
    expect(audioModelTip('music-3.0', 'Music 3.0 音乐')).toBe(MINIMAX_MUSIC_TIP)
    expect(audioModelTip('vendor-opaque-id', 'Music 3.0 音乐')).toBe(MINIMAX_MUSIC_TIP)
    expect(audioModelTip('vendor-opaque-id', '现场配音模型')).toBe(MINIMAX_TTS_TIP)
  })

  it('does not invent an SFX tip or steal video rows', () => {
    expect(audioModelTip('sfx-1', '音效')).toBe('')
    expect(audioModelTip('MiniMax-H3', '海螺 MiniMax H3')).toBe('')
    expect(audioModelTip('happyhorse-1.1-t2v', 'HappyHorse 文生视频')).toBe('')
    expect(audioModelTip('', '')).toBe('')
    expect(audioModelTip(undefined, null)).toBe('')
  })

  it('lets the model key win over a conflicting label', () => {
    expect(audioModelTip('speech-2.8-hd', 'Music 3.0 音乐')).toBe(MINIMAX_TTS_TIP)
    expect(audioModelTip('music-3.0', 'Speech 2.8 HD 配音')).toBe(MINIMAX_MUSIC_TIP)
  })
})
