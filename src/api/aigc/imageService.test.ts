import { describe, expect, it } from 'vitest'
import {
  isI2IModel,
  resolveImageReferences,
  UNSUPPORTED_REFERENCE_IMAGE_MESSAGE,
} from './imageService'

describe('isI2IModel', () => {
  it('keeps wan2.6-image as the dedicated DashScope i2i model', () => {
    expect(isI2IModel('wan2.6-image')).toBe(true)
  })

  it('treats the GPT Image family as image-input capable (backend /images/edits)', () => {
    expect(isI2IModel('gpt-image-2')).toBe(true)
    expect(isI2IModel('gpt-image-2.5-flare')).toBe(true)
    expect(isI2IModel('gpt-image-2.5-sunburst')).toBe(true)
  })

  it('does not treat text-to-image catalog models as i2i', () => {
    expect(isI2IModel('wan2.6-t2i')).toBe(false)
    expect(isI2IModel('wan2.7-image')).toBe(false)
    expect(isI2IModel('qwen-image-2.0')).toBe(false)
  })
})

describe('resolveImageReferences', () => {
  it('omits images when the user did not connect any', () => {
    expect(resolveImageReferences('gpt-image-2')).toEqual({})
    expect(resolveImageReferences('gpt-image-2', [])).toEqual({})
    expect(resolveImageReferences('wan2.6-t2i', [undefined])).toEqual({})
  })

  it('passes connected refs for GPT Image and wan2.6-image', () => {
    const refs = ['https://example.com/city.png']
    expect(resolveImageReferences('gpt-image-2', refs)).toEqual({ images: refs })
    expect(resolveImageReferences('wan2.6-image', refs)).toEqual({ images: refs })
  })

  it('does not silently drop refs on unsupported models', () => {
    expect(resolveImageReferences('wan2.6-t2i', ['https://example.com/city.png'])).toEqual({
      error: UNSUPPORTED_REFERENCE_IMAGE_MESSAGE,
    })
    expect(resolveImageReferences('qwen-image-2.0', ['https://example.com/city.png'])).toEqual({
      error: UNSUPPORTED_REFERENCE_IMAGE_MESSAGE,
    })
  })
})
