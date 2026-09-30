import { describe, expect, it } from 'vitest'
import { canvasImagePreviewMediaClass } from './canvasImagePreview'

describe('canvas image preview', () => {
  it('shows the full frame instead of center-cropping the cell', () => {
    expect(canvasImagePreviewMediaClass).toContain('object-contain')
    expect(canvasImagePreviewMediaClass).toContain('object-center')
    expect(canvasImagePreviewMediaClass.includes('object-cover')).toBe(false)
  })
})
