import { describe, expect, it } from 'vitest'
import {
  applyImageRatio,
  coerceGenerateParams,
  listImageAspectRatios,
  listImageSizes,
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
  it('exposes 1:1, 2:3, 3:2 from the model sizes — not the old 16:9/4:3/3:4/9:16 skeleton', () => {
    expect(listImageAspectRatios('gpt-image-2')).toEqual(['3:2', '1:1', '2:3'])
    const keys = listImageSizes('gpt-image-2').map((item) => item.key)
    expect(keys).toEqual(['1024x1024', '1024x1536', '1536x1024'])
    expect(listImageSizes('gpt-image-2').map((item) => item.label)).toEqual([
      '1:1 (1024x1024)',
      '2:3 (1024x1536)',
      '3:2 (1536x1024)',
    ])
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
    expect(applyImageRatio('gpt-image-2', 'medium', '16:9')).toBeNull()
    expect(applyImageRatio('gpt-image-2', 'medium', '3:4')).toBeNull()
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
