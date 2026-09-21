import { describe, expect, it } from 'vitest'
import {
  applyImageRatio,
  coerceGenerateParams,
  listImageAspectRatios,
  listImageSizes,
  listVideoAspectRatios,
  listVideoResolutions,
} from './generateParams'
import type { CustomNode } from '../types'

function imageNode(data: Partial<CustomNode['data']>): CustomNode {
  return {
    id: 'n1',
    type: 'imageConfig',
    position: { x: 0, y: 0 },
    data: { label: '画面节点', ...data },
  }
}

describe('GPT Image 2 selectable ratios', () => {
  it('derives 16:9 / 9:16 / 4:3 / 3:4 / 21:9 from the size list, labeled by true math', () => {
    expect(listImageAspectRatios('gpt-image-2')).toEqual([
      '21:9',
      '16:9',
      '3:2',
      '4:3',
      '1:1',
      '3:4',
      '2:3',
      '9:16',
    ])
    const keys = listImageSizes('gpt-image-2').map((item) => item.key)
    expect(keys).toEqual([
      '1024x1024',
      '1536x864',
      '864x1536',
      '1536x1152',
      '1152x1536',
      '1536x1024',
      '1024x1536',
      '1792x768',
    ])
    expect(listImageSizes('gpt-image-2').map((item) => item.label)).toEqual([
      '1:1 (1024x1024)',
      '16:9 (1536x864)',
      '9:16 (864x1536)',
      '4:3 (1536x1152)',
      '3:4 (1152x1536)',
      '3:2 (1536x1024)',
      '2:3 (1024x1536)',
      '21:9 (1792x768)',
    ])
    expect(listImageSizes('gpt-image-2').find((item) => item.key === '1024x1536')?.label).toBe(
      '2:3 (1024x1536)'
    )
  })

  it('maps each selectable ratio to the matching generation size key', () => {
    expect(applyImageRatio('gpt-image-2', 'medium', '1:1')).toEqual({
      size: '1024x1024',
      ratio: '1:1',
    })
    expect(applyImageRatio('gpt-image-2', 'medium', '2:3')).toEqual({
      size: '1024x1536',
      ratio: '2:3',
    })
    expect(applyImageRatio('gpt-image-2', 'medium', '3:2')).toEqual({
      size: '1536x1024',
      ratio: '3:2',
    })
    expect(applyImageRatio('gpt-image-2', 'medium', '16:9')).toEqual({
      size: '1536x864',
      ratio: '16:9',
    })
    expect(applyImageRatio('gpt-image-2', 'medium', '3:4')).toEqual({
      size: '1152x1536',
      ratio: '3:4',
    })
    expect(applyImageRatio('gpt-image-2', 'medium', '1:2')).toBeNull()
  })

  it('prefers live /ai/models sizes over the last-resort catalog', () => {
    const live = {
      key: 'gpt-image-2',
      label: 'GPT Image 2 文生图',
      type: 'image' as const,
      sizes: [
        { key: '2048x2048', label: '1:1 (2048x2048)' },
        { key: '1920x1088', label: '1920x1088' },
      ],
      getSizesByQuality: () => [
        { key: '2048x2048', label: '1:1 (2048x2048)' },
        { key: '1920x1088', label: '16:9 (1920x1088)' },
      ],
    }
    expect(listImageSizes('gpt-image-2', 'medium', live).map((item) => item.key)).toEqual([
      '2048x2048',
      '1920x1088',
    ])
    expect(listImageAspectRatios('gpt-image-2', 'medium', live)).toEqual(['16:9', '1:1'])
    expect(applyImageRatio('gpt-image-2', 'medium', '16:9', live)).toEqual({
      size: '1920x1088',
      ratio: '16:9',
    })
    expect(applyImageRatio('gpt-image-2', 'medium', '3:2', live)).toBeNull()
  })
})

describe('万相 2.7 selectable ratios', () => {
  it('still exposes its real cinematic set including 16:9 / 9:16', () => {
    expect(listImageAspectRatios('wan2.7-image')).toEqual(['16:9', '4:3', '1:1', '3:4', '9:16'])
    expect(applyImageRatio('wan2.7-image', 'standard', '16:9')).toEqual({
      size: '1696*960',
      ratio: '16:9',
    })
    expect(applyImageRatio('wan2.7-image', 'standard', '9:16')).toEqual({
      size: '960*1696',
      ratio: '9:16',
    })
  })
})

describe('video capability lookup', () => {
  it('limits HappyHorse t2v to the catalog 16:9 / 9:16 sizes instead of a generic 5-ratio skeleton', () => {
    expect(listVideoAspectRatios('happyhorse-1.1-t2v')).toEqual(['16:9', '9:16'])
    expect(listVideoResolutions('happyhorse-1.1-t2v')).toEqual(['1080P', '720P'])
    expect(listVideoResolutions('doubao-seedance-2-0-fast-260128')).toEqual(['720P'])
  })
})

describe('coerceGenerateParams', () => {
  it('rewrites a stale 3:4 label on a 1024x1536 GPT Image 2 node to 2:3', () => {
    expect(
      coerceGenerateParams(
        imageNode({ model: 'gpt-image-2', quality: 'medium', size: '1024x1536', ratio: '3:4' })
      )
    ).toEqual({ ratio: '2:3' })
  })

  it('keeps a shared 1:1 ratio when switching size keys between models', () => {
    expect(
      coerceGenerateParams(
        imageNode({ model: 'wan2.7-image', quality: 'standard', size: '1024x1024', ratio: '1:1' })
      )
    ).toEqual({ size: '1280*1280', ratio: '1:1' })
  })
})
