import { describe, expect, it } from 'vitest'
import {
  applyImageRatio,
  applyVideoRatio,
  coerceGenerateParams,
  countVideoRequestReferences,
  listImageAspectRatios,
  listImageSizes,
  listVideoAspectRatios,
  listVideoResolutions,
  normalizeVideoQuantity,
  resolveImageRequestModel,
  routedVideoModelKey,
  videoAspectSuppressedByReferences,
  videoRequestParams,
} from './generateParams'
import { collectGenerateInputs } from './generateSlots'
import type { CustomEdge, CustomNode } from '../types'

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

describe('万相 2.6 image sizes follow the model that will be called', () => {
  it('switches the aspect list from 文生图 to 图生图 when reference images are attached', () => {
    const textToImage = listImageAspectRatios('wan2.6-t2i')
    const imageToImage = listImageAspectRatios('wan2.6-image')
    expect(textToImage).toEqual(['16:9', '4:3', '1:1', '3:4', '9:16'])
    expect(imageToImage).not.toEqual(textToImage)
    expect(imageToImage).toContain('21:9')
    expect(imageToImage).toContain('3:2')
    expect(textToImage).not.toContain('21:9')

    expect(resolveImageRequestModel('wan2.6-t2i', 0, ['wan2.6-t2i', 'wan2.6-image'])).toBe('wan2.6-t2i')
    expect(resolveImageRequestModel('wan2.6-t2i', 2, ['wan2.6-t2i', 'wan2.6-image'])).toBe('wan2.6-image')
    expect(resolveImageRequestModel('wan2.6-t2i', 2, ['wan2.6-t2i'])).toBe('wan2.6-t2i')
    expect(listImageAspectRatios(resolveImageRequestModel('wan2.6-t2i', 1, ['wan2.6-image']))).toEqual(
      imageToImage
    )
  })

  it('prefers the live img2img size list over the static fallback', () => {
    const live = {
      key: 'wan2.6-image',
      label: '万相 2.6 图生图',
      type: 'image' as const,
      sizes: [
        { key: '1024*1024', label: '1:1' },
        { key: '1024*1536', label: '2:3' },
      ],
      getSizesByQuality: () => [
        { key: '1024*1024', label: '1:1' },
        { key: '1024*1536', label: '2:3' },
      ],
    }
    expect(listImageAspectRatios('wan2.6-image', 'standard', live)).toEqual(['1:1', '2:3'])
    expect(applyImageRatio('wan2.6-image', 'standard', '21:9', live)).toBeNull()
  })
})

const HAPPYHORSE_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '4:5', '5:4', '9:21', '21:9']

describe('video capability lookup', () => {
  it('lists the official HappyHorse ratios for t2v and r2v, and none for i2v', () => {
    expect(listVideoAspectRatios('happyhorse-1.1-t2v')).toEqual(HAPPYHORSE_RATIOS)
    expect(listVideoAspectRatios('happyhorse-1.1-r2v')).toEqual(HAPPYHORSE_RATIOS)
    expect(listVideoAspectRatios('happyhorse-1.1-i2v')).toEqual([])
    expect(listVideoResolutions('happyhorse-1.1-t2v')).toEqual(['1080P', '720P'])
    expect(listVideoResolutions('happyhorse-1.1-i2v')).toEqual(['1080P', '720P'])
    expect(listVideoResolutions('doubao-seedance-2-0-fast-260128')).toEqual(['720P'])
  })

  it('lets a live catalog replace the static HappyHorse ratio list', () => {
    const live = {
      key: 'happyhorse-1.1-t2v',
      label: 'HappyHorse 文生视频',
      type: 'video' as const,
      ratios: [
        { key: '16:9', label: '16:9' },
        { key: '9:16', label: '9:16' },
      ],
      supportsAspect: true,
      resolutions: [
        { key: '720P', label: '720P' },
        { key: '1080P', label: '1080P' },
        { key: '480P', label: '480P' },
      ],
    }
    expect(listVideoAspectRatios('happyhorse-1.1-t2v', live)).toEqual(['16:9', '9:16'])
    expect(listVideoResolutions('happyhorse-1.1-t2v', live)).toEqual(['1080P', '720P', '480P'])
  })

  it('still writes the t2v size map when the user picks 16:9 or 9:16', () => {
    expect(applyVideoRatio('720P', '16:9')).toEqual({
      size: '1280*720',
      resolution: '720P',
      ratio: '16:9',
    })
    expect(applyVideoRatio('720P', '9:16')).toEqual({
      size: '720*1280',
      resolution: '720P',
      ratio: '9:16',
    })
    expect(applyVideoRatio('1080P', '9:16')).toEqual({
      size: '1080*1920',
      resolution: '1080P',
      ratio: '9:16',
    })
    expect(applyVideoRatio('720P', '21:9')).toEqual({
      size: '1680*720',
      resolution: '720P',
      ratio: '21:9',
    })
    expect(applyVideoRatio('1080P', '4:5')).toEqual({
      size: '864*1080',
      resolution: '1080P',
      ratio: '4:5',
    })
  })
})

function imageRef(id: string, url?: string): CustomNode {
  return {
    id,
    type: 'image',
    position: { x: 0, y: 0 },
    data: { label: id, ...(url ? { url } : {}) },
  }
}

function edgeToVideo(id: string, source: string, slotOrder: number): CustomEdge {
  return { id, source, target: 'v1', data: { slotOrder } }
}

function visibleHappyHorseRatios(
  model: string,
  inputs: { firstFrameImage?: string; refImages?: readonly string[] }
): string[] {
  if (videoAspectSuppressedByReferences(model, inputs)) return []
  return listVideoAspectRatios(routedVideoModelKey(model, countVideoRequestReferences(inputs.firstFrameImage, inputs.refImages)))
}

describe('video aspect with reference images', () => {
  it('shows HappyHorse ratios for t2v and r2v, and hides them for a single first frame', () => {
    const empty = collectGenerateInputs('v1', [videoNode()], [])
    expect(countVideoRequestReferences(empty.firstFrameImage, empty.refImages)).toBe(0)
    expect(visibleHappyHorseRatios('happyhorse-1.1-t2v', empty)).toEqual(HAPPYHORSE_RATIOS)
    expect(videoRequestParams({
      model: 'happyhorse-1.1-t2v',
      referenceCount: 0,
      ratio: '21:9',
      resolution: '1080P',
    })).toEqual({ ratio: '21:9', resolution: '1080P', size: '2520*1080' })

    const one = collectGenerateInputs('v1', [videoNode(), imageRef('a', 'https://img/a.png')], [
      edgeToVideo('e1', 'a', 1),
    ])
    expect(countVideoRequestReferences(one.firstFrameImage, one.refImages)).toBe(1)
    expect(visibleHappyHorseRatios('happyhorse-1.1-t2v', one)).toEqual([])
    expect(visibleHappyHorseRatios('happyhorse-1.1-i2v', one)).toEqual([])
    expect(videoRequestParams({
      model: 'happyhorse-1.1-t2v',
      referenceCount: 1,
      ratio: '16:9',
      resolution: '720P',
      size: '1280*720',
    })).toEqual({ resolution: '720P', size: '1280*720' })

    const three = collectGenerateInputs(
      'v1',
      [
        videoNode(),
        imageRef('a', 'https://img/a.png'),
        imageRef('b', 'https://img/b.png'),
        imageRef('c', 'https://img/c.png'),
      ],
      [edgeToVideo('e1', 'a', 1), edgeToVideo('e2', 'b', 2), edgeToVideo('e3', 'c', 3)]
    )
    expect(countVideoRequestReferences(three.firstFrameImage, three.refImages)).toBe(3)
    expect(visibleHappyHorseRatios('happyhorse-1.1-t2v', three)).toEqual(HAPPYHORSE_RATIOS)
    expect(visibleHappyHorseRatios('happyhorse-1.1-r2v', three)).toEqual(HAPPYHORSE_RATIOS)
    expect(videoRequestParams({
      model: 'happyhorse-1.1-t2v',
      referenceCount: 3,
      ratio: '4:5',
      resolution: '720P',
    })).toEqual({ ratio: '4:5', resolution: '720P', size: '576*720' })
  })

  it('selects t2v, i2v, or r2v from the HappyHorse reference count', () => {
    expect(routedVideoModelKey('happyhorse-1.1-r2v', 0)).toBe('happyhorse-1.1-t2v')
    expect(routedVideoModelKey('happyhorse-1.1-t2v', 0)).toBe('happyhorse-1.1-t2v')
    expect(routedVideoModelKey('happyhorse-1.1-t2v', 1)).toBe('happyhorse-1.1-i2v')
    expect(routedVideoModelKey('happyhorse-1.1-i2v', 1)).toBe('happyhorse-1.1-i2v')
    expect(routedVideoModelKey('happyhorse-1.1-t2v', 2)).toBe('happyhorse-1.1-r2v')
    expect(routedVideoModelKey('happyhorse-1.1-i2v', 3)).toBe('happyhorse-1.1-r2v')
    expect(routedVideoModelKey('doubao-seedance-2-0-260128', 2)).toBe('doubao-seedance-2-0-260128')
    expect(routedVideoModelKey('MiniMax-H3', 3)).toBe('MiniMax-H3')
    expect(routedVideoModelKey('viduq3-pro', 2)).toBe('viduq3-pro')
  })

  it('keeps the t2v aspect control when nothing image-like would be sent', () => {
    const empty = collectGenerateInputs('v1', [videoNode()], [])
    expect(videoAspectSuppressedByReferences('happyhorse-1.1-t2v', empty)).toBe(false)
    expect(videoAspectSuppressedByReferences('happyhorse-1.1-i2v', empty)).toBe(false)
    expect(videoAspectSuppressedByReferences('happyhorse-1.1-r2v', empty)).toBe(false)

    const textOnly = collectGenerateInputs(
      'v1',
      [
        videoNode(),
        {
          id: 'note',
          type: 'text',
          position: { x: 0, y: 0 },
          data: { label: '旁白', content: '夜色' },
        },
      ],
      [edgeToVideo('e1', 'note', 1)]
    )
    expect(countVideoRequestReferences(textOnly.firstFrameImage, textOnly.refImages)).toBe(0)
    expect(videoAspectSuppressedByReferences('happyhorse-1.1-t2v', textOnly)).toBe(false)

    const unloaded = collectGenerateInputs('v1', [videoNode(), imageRef('a')], [edgeToVideo('e1', 'a', 1)])
    expect(videoAspectSuppressedByReferences('happyhorse-1.1-t2v', unloaded)).toBe(false)
  })

  it('keeps aspect for models that still send size when references are attached', () => {
    const inputs = collectGenerateInputs('v1', [videoNode(), imageRef('a', 'https://img/a.png')], [
      edgeToVideo('e1', 'a', 1),
    ])
    expect(videoAspectSuppressedByReferences('doubao-seedance-2-0-260128', inputs)).toBe(false)
    expect(videoAspectSuppressedByReferences('MiniMax-H3', inputs)).toBe(false)
    expect(videoAspectSuppressedByReferences('viduq3-pro', inputs)).toBe(false)
  })
})

function videoNode(data: Partial<CustomNode['data']>): CustomNode {
  return {
    id: 'v1',
    type: 'videoConfig',
    position: { x: 0, y: 0 },
    data: {
      label: '视频节点',
      model: 'happyhorse-1.1-t2v',
      size: '1280*720',
      resolution: '720P',
      ratio: '16:9',
      duration: 5,
      ...data,
    },
  }
}

describe('video quantity', () => {
  it('accepts 1, 2 and 4 and treats anything else as one clip', () => {
    expect(normalizeVideoQuantity(undefined)).toBe(1)
    expect(normalizeVideoQuantity(1)).toBe(1)
    expect(normalizeVideoQuantity(2)).toBe(2)
    expect(normalizeVideoQuantity(4)).toBe(4)
    expect(normalizeVideoQuantity(3)).toBe(1)
  })

  it('keeps a valid count and rewrites an invalid one', () => {
    expect(coerceGenerateParams(videoNode({ n: 4 }))).toBeNull()
    expect(coerceGenerateParams(videoNode({ n: 3 }))).toEqual({ n: 1 })
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
