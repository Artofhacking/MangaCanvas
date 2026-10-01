import { describe, expect, it } from 'vitest'
import {
  HAPPYHORSE_VIDEO_TIP,
  MINIMAX_VIDEO_TIP,
  SEEDANCE_VIDEO_TIP,
  VIDU_VIDEO_TIP,
  videoModelTip,
} from './videoModelTip'

describe('videoModelTip', () => {
  it('gives HappyHorse one family tip, including routed t2v / i2v / r2v ids', () => {
    for (const key of [
      'happyhorse-1.1-t2v',
      'happyhorse-1.1-i2v',
      'happyhorse-1.1-r2v',
      'happyhorse',
      'happy-horse-1.1-t2v',
      'HAPPYHORSE-1.1-T2V',
    ]) {
      expect(videoModelTip(key, 'HappyHorse 文生视频')).toBe(HAPPYHORSE_VIDEO_TIP)
    }
    expect(HAPPYHORSE_VIDEO_TIP).toContain('文生视频')
    expect(HAPPYHORSE_VIDEO_TIP).toContain('首帧')
    expect(HAPPYHORSE_VIDEO_TIP).toContain('多参考图')
  })

  it('matches Seedance from doubao ids and from the display label', () => {
    expect(videoModelTip('doubao-seedance-2-0-260128', 'Seedance 2.0')).toBe(SEEDANCE_VIDEO_TIP)
    expect(videoModelTip('doubao-seedance-2-0-fast-260128', 'Seedance 2.0 Fast')).toBe(SEEDANCE_VIDEO_TIP)
    expect(videoModelTip('doubao-seedance-2-5-260628', 'Seedance 2.5')).toBe(SEEDANCE_VIDEO_TIP)
    expect(videoModelTip('seedance-2.0', 'Seedance 2.0')).toBe(SEEDANCE_VIDEO_TIP)
    expect(videoModelTip('vendor-opaque-id', 'Seedance 2.0 Fast')).toBe(SEEDANCE_VIDEO_TIP)
  })

  it('matches MiniMax / 海螺 keys and labels', () => {
    expect(videoModelTip('MiniMax-H3', '海螺 MiniMax H3')).toBe(MINIMAX_VIDEO_TIP)
    expect(videoModelTip('MiniMax-H3-Max', '海螺 MiniMax H3 Max')).toBe(MINIMAX_VIDEO_TIP)
    expect(videoModelTip('hailuo-i2v', '海螺 图生视频')).toBe(MINIMAX_VIDEO_TIP)
    expect(videoModelTip('live-minimax-row', '海螺 图生视频')).toBe(MINIMAX_VIDEO_TIP)
  })

  it('matches Vidu keys without hard-coding every id', () => {
    expect(videoModelTip('viduq3-pro', 'Vidu Q3 Pro')).toBe(VIDU_VIDEO_TIP)
    expect(videoModelTip('viduq3-turbo', 'Vidu Q3 Turbo')).toBe(VIDU_VIDEO_TIP)
    expect(videoModelTip('future-row', 'Vidu Q3 Pro')).toBe(VIDU_VIDEO_TIP)
  })

  it('returns empty for unknown, blank, and non-video keys', () => {
    expect(videoModelTip('not-a-video-model', '未知现场模型')).toBe('')
    expect(videoModelTip('gpt-image-2', 'GPT Image 2 文生图')).toBe('')
    expect(videoModelTip('wan2.7-image', '万相 2.7 文生图')).toBe('')
    expect(videoModelTip('', '')).toBe('')
    expect(videoModelTip('   ', undefined)).toBe('')
    expect(videoModelTip(undefined, null)).toBe('')
  })

  it('prefers the key family when the label names a different model', () => {
    expect(videoModelTip('happyhorse-1.1-t2v', 'Seedance 2.0')).toBe(HAPPYHORSE_VIDEO_TIP)
  })
})
