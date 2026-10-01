import { describe, expect, it } from 'vitest'
import {
  GPT_IMAGE_2_5_TIP,
  GPT_IMAGE_2_TIP,
  QWEN_IMAGE_2_PRO_TIP,
  QWEN_IMAGE_2_TIP,
  WAN_2_6_IMAGE_TIP,
  WAN_2_6_T2I_TIP,
  WAN_2_7_IMAGE_PRO_TIP,
  WAN_2_7_IMAGE_TIP,
  imageModelTip,
} from './imageModelTip'

describe('imageModelTip', () => {
  it('matches GPT Image 2 and later patch ids, but not 2.5', () => {
    expect(imageModelTip('gpt-image-2', 'GPT Image 2 文生图')).toBe(GPT_IMAGE_2_TIP)
    expect(imageModelTip('GPT-IMAGE-2', 'GPT Image 2')).toBe(GPT_IMAGE_2_TIP)
    expect(imageModelTip('gpt-image-2-2026-04-21', 'GPT Image 2 文生图')).toBe(GPT_IMAGE_2_TIP)
    expect(imageModelTip('gpt-image-2.5-flare', 'GPT Image 2.5 Flare 文生图')).not.toBe(GPT_IMAGE_2_TIP)
  })

  it('shares one GPT Image 2.5 tip across Flare, Sunburst, and patch ids', () => {
    for (const key of [
      'gpt-image-2.5-flare',
      'gpt-image-2.5-sunburst',
      'GPT-IMAGE-2.5-FLARE',
      'gpt-image-2.5-flare-20261001',
      'gpt-image-2.5-sunburst-preview',
      'gpt-image-2-5-flare',
    ]) {
      expect(imageModelTip(key, 'GPT Image 2.5 Flare 文生图')).toBe(GPT_IMAGE_2_5_TIP)
    }
    expect(imageModelTip('vendor-opaque-id', 'GPT Image 2.5 Sunburst 文生图')).toBe(GPT_IMAGE_2_5_TIP)
    expect(imageModelTip('vendor-opaque-id', 'GPT Image 2.5 Flare')).toBe(GPT_IMAGE_2_5_TIP)
  })

  it('matches Wan 2.7 and its Pro row separately, including patch suffixes', () => {
    expect(imageModelTip('wan2.7-image', '万相 2.7 文生图')).toBe(WAN_2_7_IMAGE_TIP)
    expect(imageModelTip('wan2.7-image-20261001', '万相 2.7 文生图')).toBe(WAN_2_7_IMAGE_TIP)
    expect(imageModelTip('Wan2.7_Image_Pro', '万相 2.7 文生图 Pro')).toBe(WAN_2_7_IMAGE_PRO_TIP)
    expect(imageModelTip('wan2.7-image-pro', '万相 2.7 文生图 Pro')).toBe(WAN_2_7_IMAGE_PRO_TIP)
    expect(imageModelTip('wan2.7-image-pro-20261001', '万相 2.7 文生图 Pro')).toBe(WAN_2_7_IMAGE_PRO_TIP)
    expect(imageModelTip('wan2.7-image-pro', '万相 2.7 文生图')).not.toBe(WAN_2_7_IMAGE_TIP)
    expect(imageModelTip('vendor-opaque-id', '万相 2.7 文生图')).toBe(WAN_2_7_IMAGE_TIP)
    expect(imageModelTip('vendor-opaque-id', '万相 2.7 文生图 Pro')).toBe(WAN_2_7_IMAGE_PRO_TIP)
  })

  it('matches Wan 2.6 text-to-image and image-to-image as different rows', () => {
    expect(imageModelTip('wan2.6-t2i', '万相 2.6 文生图')).toBe(WAN_2_6_T2I_TIP)
    expect(imageModelTip('wan2.6-t2i-v2', '万相 2.6 文生图')).toBe(WAN_2_6_T2I_TIP)
    expect(imageModelTip('wan2.6-image', '万相 2.6 图生图')).toBe(WAN_2_6_IMAGE_TIP)
    expect(imageModelTip('wan2.6-image-v2', '万相 2.6 图生图')).toBe(WAN_2_6_IMAGE_TIP)
    expect(imageModelTip('vendor-opaque-id', '万相 2.6 文生图')).toBe(WAN_2_6_T2I_TIP)
    expect(imageModelTip('vendor-opaque-id', '万相 2.6 图生图')).toBe(WAN_2_6_IMAGE_TIP)
  })

  it('matches Qwen Image 2.0 and Pro separately, including patch suffixes', () => {
    expect(imageModelTip('qwen-image-2.0', '通义千问生图')).toBe(QWEN_IMAGE_2_TIP)
    expect(imageModelTip('qwen-image-2.0-20261001', '通义千问生图')).toBe(QWEN_IMAGE_2_TIP)
    expect(imageModelTip('qwen-image-2.0-pro', '通义千问生图 Pro')).toBe(QWEN_IMAGE_2_PRO_TIP)
    expect(imageModelTip('qwen-image-2.0-pro-v2', '通义千问生图 Pro')).toBe(QWEN_IMAGE_2_PRO_TIP)
    expect(imageModelTip('qwen-image-2.0-pro', '通义千问生图')).not.toBe(QWEN_IMAGE_2_TIP)
    expect(imageModelTip('vendor-opaque-id', '通义千问生图')).toBe(QWEN_IMAGE_2_TIP)
    expect(imageModelTip('vendor-opaque-id', '通义千问生图 Pro')).toBe(QWEN_IMAGE_2_PRO_TIP)
    expect(imageModelTip('vendor-opaque-id', 'Qwen Image 2.0')).toBe(QWEN_IMAGE_2_TIP)
    expect(imageModelTip('vendor-opaque-id', 'Qwen Image 2.0 Pro')).toBe(QWEN_IMAGE_2_PRO_TIP)
  })

  it('falls back to the catalog label when the live key is opaque', () => {
    expect(imageModelTip('live-row', 'GPT Image 2 文生图')).toBe(GPT_IMAGE_2_TIP)
    expect(imageModelTip('live-row', 'GPT Image 2.5 Flare 文生图')).toBe(GPT_IMAGE_2_5_TIP)
  })

  it('returns empty for unknown, blank, and non-image keys', () => {
    expect(imageModelTip('not-an-image-model', '未知现场模型')).toBe('')
    expect(imageModelTip('happyhorse-1.1-t2v', 'HappyHorse 文生视频')).toBe('')
    expect(imageModelTip('qwen-image-plus', 'Qwen Image Plus')).toBe('')
    expect(imageModelTip('qwen-plus', '通义千问')).toBe('')
    expect(imageModelTip('', '')).toBe('')
    expect(imageModelTip('   ', undefined)).toBe('')
    expect(imageModelTip(undefined, null)).toBe('')
  })

  it('prefers the key when the label names a different model', () => {
    expect(imageModelTip('gpt-image-2', 'GPT Image 2.5 Flare 文生图')).toBe(GPT_IMAGE_2_TIP)
    expect(imageModelTip('wan2.7-image-pro', '万相 2.7 文生图')).toBe(WAN_2_7_IMAGE_PRO_TIP)
    expect(imageModelTip('wan2.7-image', '万相 2.7 文生图 Pro')).toBe(WAN_2_7_IMAGE_TIP)
    expect(imageModelTip('wan2.6-image', '万相 2.6 文生图')).toBe(WAN_2_6_IMAGE_TIP)
    expect(imageModelTip('wan2.6-t2i', '万相 2.6 图生图')).toBe(WAN_2_6_T2I_TIP)
    expect(imageModelTip('qwen-image-2.0', '通义千问生图 Pro')).toBe(QWEN_IMAGE_2_TIP)
    expect(imageModelTip('qwen-image-2.0-pro', 'GPT Image 2 文生图')).toBe(QWEN_IMAGE_2_PRO_TIP)
  })
})
