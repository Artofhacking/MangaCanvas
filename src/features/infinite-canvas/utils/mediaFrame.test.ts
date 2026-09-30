import { describe, expect, it } from 'vitest'
import {
  formatMediaResolution,
  measurePreviewImage,
  mediaFrameCssAspect,
  mediaPixelPatch,
  mediaResolutionLabel,
  nextMediaPixelFields,
  readBlobPixelSize,
  readExplicitMediaPixels,
  readStoredMediaPixels,
} from './mediaFrame'

describe('media frame aspect', () => {
  it('prefers exact pixels over a snapped ratio or size key', () => {
    expect(mediaFrameCssAspect({ width: 1696, height: 960, ratio: '16:9', size: '1280*720' })).toBe('1696 / 960')
    expect(mediaFrameCssAspect({ size: '2048x1152', ratio: '1:1' })).toBe('2048 / 1152')
    expect(mediaFrameCssAspect({ ratio: '9:16' })).toBe('9:16')
    expect(mediaFrameCssAspect({})).toBeUndefined()
    expect(mediaFrameCssAspect({ size: '720P' })).toBeUndefined()
  })

  it('reads numeric strings saved in canvas JSON', () => {
    expect(readExplicitMediaPixels({ width: '1536', height: '2048' })).toEqual({ width: 1536, height: 2048 })
    expect(readStoredMediaPixels({ size: '1280*720' })).toEqual({ width: 1280, height: 720 })
  })
})

describe('media resolution label', () => {
  it('formats width and height like 2048×1152', () => {
    expect(formatMediaResolution(2048, 1152)).toBe('2048×1152')
    expect(mediaResolutionLabel({ width: 1536, height: 2048 })).toBe('1536×2048')
    expect(mediaResolutionLabel({ size: '1024x1536' })).toBe('1024×1536')
    expect(mediaResolutionLabel({ ratio: '16:9' })).toBeUndefined()
  })
})

describe('media pixel patch', () => {
  it('skips a write when the node already stores the same pixels', () => {
    expect(mediaPixelPatch({ width: 2048, height: 1152 }, { width: 2048, height: 1152 })).toBeNull()
    expect(mediaPixelPatch({ width: 100, height: 100 }, { width: 2048, height: 1152 })).toEqual({
      width: 2048,
      height: 1152,
    })
    expect(nextMediaPixelFields(null)).toEqual({ width: undefined, height: undefined })
    expect(nextMediaPixelFields({ width: 800, height: 600 })).toEqual({ width: 800, height: 600 })
  })
})

describe('measurePreviewImage', () => {
  it('keeps a downscaled preview out of the resolution badge', () => {
    expect(measurePreviewImage({
      displaySrc: 'blob:http://local/preview',
      originalUrl: 'https://cdn.example/full.png',
      naturalWidth: 256,
      naturalHeight: 144,
      cachedSource: null,
    })).toEqual({
      aspect: '256 / 144',
      pixels: null,
    })
  })

  it('uses the decoded original size when the card shows the file itself', () => {
    expect(measurePreviewImage({
      displaySrc: 'https://cdn.example/full.png',
      originalUrl: 'https://cdn.example/full.png',
      naturalWidth: 2048,
      naturalHeight: 1152,
    })).toEqual({
      aspect: '2048 / 1152',
      pixels: { width: 2048, height: 1152 },
    })
  })

  it('labels the original pixels cached while downscaling', () => {
    expect(measurePreviewImage({
      displaySrc: 'blob:http://local/preview',
      originalUrl: '/static/generated/full.png',
      naturalWidth: 256,
      naturalHeight: 144,
      cachedSource: { width: 2048, height: 1152 },
    })).toEqual({
      aspect: '2048 / 1152',
      pixels: { width: 2048, height: 1152 },
    })
  })

  it('does not treat a distinct thumbnail as the original resolution', () => {
    expect(measurePreviewImage({
      displaySrc: 'https://cdn.example/thumb.jpg',
      originalUrl: 'https://cdn.example/full.png',
      naturalWidth: 320,
      naturalHeight: 180,
    })).toEqual({
      aspect: '320 / 180',
      pixels: null,
    })
  })
})

describe('readBlobPixelSize', () => {
  it('reads bitmap dimensions and ignores decode failures', async () => {
    const original = globalThis.createImageBitmap
    globalThis.createImageBitmap = async () => ({
      width: 2048,
      height: 1152,
      close() {},
    }) as ImageBitmap
    try {
      await expect(readBlobPixelSize(new Blob(['x']))).resolves.toEqual({ width: 2048, height: 1152 })
    } finally {
      globalThis.createImageBitmap = original
    }

    globalThis.createImageBitmap = async () => {
      throw new Error('decode failed')
    }
    try {
      await expect(readBlobPixelSize(new Blob(['x']))).resolves.toBeNull()
    } finally {
      globalThis.createImageBitmap = original
    }
  })
})
