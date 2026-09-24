import { describe, expect, it } from 'vitest'
import {
  CANVAS_MULTI_SELECTION_KEYS,
  CANVAS_PAN_ACTIVATION_KEY,
  CANVAS_PAN_BUTTONS,
  getCanvasPanOnDrag,
  isMediaPreviewDoubleClick,
  pointerTravelExceeds,
} from './canvasInteraction'

describe('getCanvasPanOnDrag', () => {
  it('lets left-drag pan when the canvas is locked (marquee is off)', () => {
    expect(getCanvasPanOnDrag(true)).toBe(true)
  })

  it('keeps left-drag for node move and marquee, and pans with middle/right when unlocked', () => {
    expect(getCanvasPanOnDrag(false)).toEqual([1, 2])
    expect(getCanvasPanOnDrag(false)).not.toContain(0)
    expect(CANVAS_PAN_BUTTONS).toEqual([1, 2])
  })
})

describe('media preview gesture', () => {
  it('does not open the lightbox on a single click', () => {
    expect(isMediaPreviewDoubleClick(1_000, 0)).toBe(false)
    expect(isMediaPreviewDoubleClick(1_500, 1_000)).toBe(false)
  })

  it('opens the lightbox on the second click of a double-click', () => {
    expect(isMediaPreviewDoubleClick(1_200, 1_000)).toBe(true)
  })
})

describe('pointerTravelExceeds', () => {
  it('treats a stationary click as a click', () => {
    expect(pointerTravelExceeds({ x: 10, y: 10 }, { clientX: 12, clientY: 11 })).toBe(false)
  })

  it('treats a real drag as not a click', () => {
    expect(pointerTravelExceeds({ x: 10, y: 10 }, { clientX: 28, clientY: 10 })).toBe(true)
    expect(pointerTravelExceeds(null, { clientX: 28, clientY: 10 })).toBe(false)
  })
})

describe('canvas selection and pan keys', () => {
  it('supports Shift click in addition to Cmd/Ctrl', () => {
    expect(CANVAS_MULTI_SELECTION_KEYS).toEqual(['Shift', 'Meta', 'Control'])
  })

  it('keeps Space as an extra pan modifier, not the only way to pan', () => {
    expect(CANVAS_PAN_ACTIVATION_KEY).toBe('Space')
  })
})
