import { describe, expect, it } from 'vitest'
import {
  CANVAS_MULTI_SELECTION_KEYS,
  CANVAS_PAN_ACTIVATION_KEY,
  CANVAS_PAN_BUTTONS,
  getCanvasPanOnDrag,
} from './canvasInteraction'

describe('getCanvasPanOnDrag', () => {
  it('lets left-drag pan when the canvas is locked (marquee is off)', () => {
    expect(getCanvasPanOnDrag(true)).toBe(true)
  })

  it('keeps left-drag for marquee and pans with middle/right when unlocked', () => {
    expect(getCanvasPanOnDrag(false)).toEqual([1, 2])
    expect(CANVAS_PAN_BUTTONS).toEqual([1, 2])
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
