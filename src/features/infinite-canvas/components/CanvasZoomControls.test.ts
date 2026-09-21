import { describe, expect, it } from 'vitest'
import { formatCanvasZoomPercent } from './CanvasZoomControls'

describe('formatCanvasZoomPercent', () => {
  it('rounds React Flow zoom to a whole-number percent', () => {
    expect(formatCanvasZoomPercent(0.29)).toBe('29%')
    expect(formatCanvasZoomPercent(1)).toBe('100%')
    expect(formatCanvasZoomPercent(1.205)).toBe('121%')
    expect(formatCanvasZoomPercent(0.1)).toBe('10%')
    expect(formatCanvasZoomPercent(2)).toBe('200%')
  })
})
