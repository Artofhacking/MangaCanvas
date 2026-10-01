import { describe, expect, it } from 'vitest'
import {
  CANVAS_VIDEO_SEEK_FAN_EDGE,
  CANVAS_VIDEO_SEEK_FAN_GAP,
  CANVAS_VIDEO_SEEK_MUTE_INSET,
  canvasVideoProgressRatio,
  canvasVideoSeekBarClass,
  canvasVideoSeekBarInsets,
  canvasVideoUsesNativeControls,
  formatCanvasVideoTime,
  readCanvasVideoClock,
  seekRatioFromPointer,
  seekTimeFromKeyboard,
  seekTimeFromRatio,
  shouldShowCanvasVideoSeekBar,
} from './canvasVideoSeek'

describe('canvas video seek bar', () => {
  it('keeps native controls off the inline player', () => {
    expect(canvasVideoUsesNativeControls).toBe(false)
  })

  it('is an overlay that does not drag or pan the canvas', () => {
    expect(canvasVideoSeekBarClass).toContain('nodrag')
    expect(canvasVideoSeekBarClass).toContain('nopan')
    expect(canvasVideoSeekBarClass).toContain('nowheel')
    expect(canvasVideoSeekBarClass).toContain('absolute')
  })

  it('formats a playback clock', () => {
    expect(formatCanvasVideoTime(0)).toBe('0:00')
    expect(formatCanvasVideoTime(5.9)).toBe('0:05')
    expect(formatCanvasVideoTime(65)).toBe('1:05')
    expect(formatCanvasVideoTime(3661)).toBe('1:01:01')
    expect(formatCanvasVideoTime(Number.NaN)).toBe('0:00')
    expect(formatCanvasVideoTime(-3)).toBe('0:00')
  })

  it('maps a pointer on the track to a ratio', () => {
    expect(seekRatioFromPointer(50, 0, 100)).toBe(0.5)
    expect(seekRatioFromPointer(-10, 0, 100)).toBe(0)
    expect(seekRatioFromPointer(140, 0, 100)).toBe(1)
    expect(seekRatioFromPointer(10, 0, 0)).toBe(0)
    expect(seekRatioFromPointer(Number.NaN, 0, 100)).toBe(0)
  })

  it('seeks to ratio × duration and stays inside the looped end', () => {
    expect(seekTimeFromRatio(0.5, 10)).toBe(5)
    expect(seekTimeFromRatio(0, 10)).toBe(0)
    expect(seekTimeFromRatio(1, 10)).toBeCloseTo(9.95)
    expect(seekTimeFromRatio(2, 10)).toBeCloseTo(9.95)
    expect(seekTimeFromRatio(1, 0)).toBeNull()
    expect(seekTimeFromRatio(1, Number.NaN)).toBeNull()
    expect(seekTimeFromRatio(1, Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('drives the thumb from the media clock', () => {
    expect(canvasVideoProgressRatio(2.5, 10)).toBe(0.25)
    expect(canvasVideoProgressRatio(12, 10)).toBe(1)
    expect(canvasVideoProgressRatio(1, 0)).toBe(0)
    expect(readCanvasVideoClock(3, 12)).toEqual({ current: 3, duration: 12, ratio: 0.25 })
    expect(readCanvasVideoClock(Number.NaN, Number.NaN)).toEqual({ current: 0, duration: 0, ratio: 0 })
  })

  it('steps the clock from the keyboard without running past the end', () => {
    expect(seekTimeFromKeyboard(2, 10, 1)).toBe(3)
    expect(seekTimeFromKeyboard(0.2, 10, -1)).toBe(0)
    expect(seekTimeFromKeyboard(9.9, 10, 1)).toBeCloseTo(9.95)
    expect(seekTimeFromKeyboard(1, 0, 1)).toBeNull()
  })

  it('shows the bar only for the in-view clip that already owns the decoder', () => {
    const playing = {
      hasPlayableUrl: true,
      suspended: false,
      inViewport: true,
      ownsDecoder: true,
    }
    expect(shouldShowCanvasVideoSeekBar(playing)).toBe(true)
    expect(shouldShowCanvasVideoSeekBar({ ...playing, ownsDecoder: false })).toBe(false)
    expect(shouldShowCanvasVideoSeekBar({ ...playing, inViewport: false })).toBe(false)
    expect(shouldShowCanvasVideoSeekBar({ ...playing, suspended: true })).toBe(false)
    expect(shouldShowCanvasVideoSeekBar({ ...playing, hasPlayableUrl: false })).toBe(false)
  })

  it('clears the mute chip, and the stack fan when several clips share the card', () => {
    expect(canvasVideoSeekBarInsets({ stacked: false, fanWidth: 0 })).toEqual({
      left: 10,
      right: CANVAS_VIDEO_SEEK_MUTE_INSET,
    })
    expect(canvasVideoSeekBarInsets({ stacked: true, fanWidth: 76 })).toEqual({
      left: CANVAS_VIDEO_SEEK_MUTE_INSET,
      right: CANVAS_VIDEO_SEEK_FAN_EDGE + 76 + CANVAS_VIDEO_SEEK_FAN_GAP,
    })
    expect(canvasVideoSeekBarInsets({ stacked: true, fanWidth: Number.NaN }).right).toBe(
      CANVAS_VIDEO_SEEK_FAN_EDGE + CANVAS_VIDEO_SEEK_FAN_GAP,
    )
  })
})
