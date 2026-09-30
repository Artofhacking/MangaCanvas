import { describe, expect, it } from 'vitest'
import { canvasVideoPreviewMediaClass, canvasVideoPreviewStageClass } from './canvasVideoPreview'

describe('canvas video preview', () => {
  it('fills the card without a black stage or a center crop', () => {
    expect(canvasVideoPreviewStageClass.includes('bg-black')).toBe(false)
    expect(canvasVideoPreviewMediaClass).toContain('object-contain')
    expect(canvasVideoPreviewMediaClass.includes('object-cover')).toBe(false)
    expect(canvasVideoPreviewMediaClass.includes('bg-black')).toBe(false)
  })
})
