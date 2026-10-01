import { describe, expect, it } from 'vitest'
import { happyHorseOutboundOptions } from './videoService'

describe('happyHorseOutboundOptions', () => {
  it('keeps t2v and ratio when there are no reference images', () => {
    const outbound = happyHorseOutboundOptions({
      model: 'happyhorse-1.1-r2v',
      prompt: '空镜',
      ratio: '21:9',
      resolution: '1080P',
      duration: 5,
    })
    expect(outbound.model).toBe('happyhorse-1.1-t2v')
    expect(outbound.ratio).toBe('21:9')
    expect(outbound.images).toBeUndefined()
    expect(outbound.model).not.toContain('r2v')
  })

  it('sends i2v and only the first frame for one or more refs', () => {
    const one = happyHorseOutboundOptions({
      model: 'happyhorse-1.1-t2v',
      prompt: '开门',
      firstFrameImage: 'https://img/a.png',
      ratio: '16:9',
    })
    expect(one.model).toBe('happyhorse-1.1-i2v')
    expect(one.images).toEqual(['https://img/a.png'])
    expect(one.ratio).toBeUndefined()

    const many = happyHorseOutboundOptions({
      model: 'happyhorse-1.1-r2v',
      prompt: '双人',
      images: ['https://img/a.png', 'https://img/b.png', 'https://img/c.png'],
      imageNames: ['甲', '乙', '丙'],
      ratio: '4:5',
    })
    expect(many.model).toBe('happyhorse-1.1-i2v')
    expect(many.model).not.toContain('r2v')
    expect(many.images).toEqual(['https://img/a.png'])
    expect(many.firstFrameImage).toBe('https://img/a.png')
    expect(many.imageNames).toEqual(['甲'])
    expect(many.ratio).toBeUndefined()
  })

  it('does not rewrite Seedance, MiniMax, or Vidu', () => {
    for (const model of ['doubao-seedance-2-0-260128', 'MiniMax-H3', 'viduq3-pro']) {
      const outbound = happyHorseOutboundOptions({
        model,
        prompt: 'run',
        images: ['https://img/a.png', 'https://img/b.png'],
        ratio: '16:9',
      })
      expect(outbound.model).toBe(model)
      expect(outbound.images).toEqual(['https://img/a.png', 'https://img/b.png'])
      expect(outbound.ratio).toBe('16:9')
    }
  })
})
