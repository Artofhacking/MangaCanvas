import { describe, expect, it } from 'vitest'
import { displayModelName } from './displayModelName'

describe('displayModelName', () => {
  it('strips modality suffixes and keeps Pro / Fast / Max / Flare / Sunburst', () => {
    expect(displayModelName('GPT Image 2 文生图')).toBe('GPT Image 2')
    expect(displayModelName('GPT Image 2.5 Flare 文生图')).toBe('GPT Image 2.5 Flare')
    expect(displayModelName('GPT Image 2.5 Sunburst 文生图')).toBe('GPT Image 2.5 Sunburst')
    expect(displayModelName('万相 2.7 文生图')).toBe('万相 2.7')
    expect(displayModelName('万相 2.7 文生图 Pro')).toBe('万相 2.7 Pro')
    expect(displayModelName('通义千问生图')).toBe('通义千问')
    expect(displayModelName('通义千问生图 Pro')).toBe('通义千问 Pro')
    expect(displayModelName('万相 2.6 图生图')).toBe('万相 2.6')
    expect(displayModelName('HappyHorse 文生视频')).toBe('HappyHorse')
    expect(displayModelName('HappyHorse 图生视频')).toBe('HappyHorse')
    expect(displayModelName('HappyHorse 参考图生视频')).toBe('HappyHorse')
    expect(displayModelName('海螺 图生视频')).toBe('海螺')
    expect(displayModelName('Seedance 2.0 Fast')).toBe('Seedance 2.0 Fast')
    expect(displayModelName('MiniMax H3 Max')).toBe('MiniMax H3 Max')
    expect(displayModelName('海螺 MiniMax H3')).toBe('海螺 MiniMax H3')
  })

  it('does not change empty input or invent an id', () => {
    expect(displayModelName('')).toBe('')
    expect(displayModelName(undefined)).toBe('')
    expect(displayModelName('gpt-image-2')).toBe('gpt-image-2')
  })
})
