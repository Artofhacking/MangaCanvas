import { describe, expect, it } from 'vitest'
import { HttpError } from '@/api/core/error'
import {
  IMAGE_GENERATION_TIMEOUT_MESSAGE,
  imageGenerationErrorMessage,
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

  it('treats 万相 2.7 and Pro as optional-reference models', () => {
    expect(isI2IModel('wan2.7-image')).toBe(true)
    expect(isI2IModel('wan2.7-image-pro')).toBe(true)
  })

  it('does not treat unrelated text-to-image catalog models as i2i', () => {
    expect(isI2IModel('wan2.6-t2i')).toBe(false)
    expect(isI2IModel('qwen-image-2.0')).toBe(false)
    expect(isI2IModel('qwen-image-2.0-pro')).toBe(false)
  })
})

describe('imageGenerationErrorMessage', () => {
  it('turns transport and gateway timeouts into a clear retry hint', () => {
    expect(imageGenerationErrorMessage(new HttpError('timeout of 600000ms exceeded', { code: 'ECONNABORTED' }))).toBe(
      IMAGE_GENERATION_TIMEOUT_MESSAGE
    )
    expect(imageGenerationErrorMessage(new HttpError('Request failed with status code 504', { status: 504 }))).toBe(
      IMAGE_GENERATION_TIMEOUT_MESSAGE
    )
    expect(imageGenerationErrorMessage(new Error('The read operation timed out'))).toBe(IMAGE_GENERATION_TIMEOUT_MESSAGE)
  })

  it('turns an upstream JSON body into a short Chinese hint', () => {
    const text = imageGenerationErrorMessage(
      new Error('生成任务提交失败: {"code":"InvalidParameter","message":"The size is not supported","type":"BadRequest"}')
    )
    expect(text).toBe('生成任务提交失败。分辨率或尺寸不被该模型支持，请调整后重试。')
    expect(text).not.toContain('{')
  })

  it('leaves model rejection and cancel messages alone', () => {
    expect(imageGenerationErrorMessage(new Error(UNSUPPORTED_REFERENCE_IMAGE_MESSAGE))).toBe(
      UNSUPPORTED_REFERENCE_IMAGE_MESSAGE
    )
    expect(imageGenerationErrorMessage(new Error('已取消'))).toBe('已取消')
  })
})

describe('resolveImageReferences', () => {
  it('omits images when the user did not connect any', () => {
    expect(resolveImageReferences('gpt-image-2')).toEqual({})
    expect(resolveImageReferences('gpt-image-2', [])).toEqual({})
    expect(resolveImageReferences('wan2.7-image', [])).toEqual({})
    expect(resolveImageReferences('wan2.7-image-pro', [undefined])).toEqual({})
    expect(resolveImageReferences('wan2.6-t2i', [undefined])).toEqual({})
  })

  it('passes connected refs for GPT Image, 万相 2.7, and wan2.6-image', () => {
    const refs = ['https://example.com/city.png', 'https://example.com/extra.png']
    expect(resolveImageReferences('gpt-image-2', refs)).toEqual({ images: refs })
    expect(resolveImageReferences('wan2.7-image', refs)).toEqual({ images: refs })
    expect(resolveImageReferences('wan2.7-image-pro', refs)).toEqual({ images: refs })
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
