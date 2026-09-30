import { describe, expect, it } from 'vitest'
import { canvasImagePreviewMediaClass } from './canvasImagePreview'

describe('canvas image preview', () => {
  it('shows the full frame instead of center-cropping or letterboxing on black', () => {
    expect(canvasImagePreviewMediaClass).toContain('object-contain')
    expect(canvasImagePreviewMediaClass).toContain('object-center')
    expect(canvasImagePreviewMediaClass.includes('object-cover')).toBe(false)
    expect(canvasImagePreviewMediaClass.includes('bg-black')).toBe(false)
  })
})
