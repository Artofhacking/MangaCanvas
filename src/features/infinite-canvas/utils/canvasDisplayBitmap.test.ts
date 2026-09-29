import { describe, expect, it } from 'vitest'
import {
  CANVAS_DISPLAY_MAX_EDGE,
  createAsyncLimiter,
  fitDisplayEdge,
  revokeCanvasObjectUrl,
} from './canvasDisplayBitmap'

describe('fitDisplayEdge', () => {
  it('caps the long edge and keeps aspect ratio', () => {
    expect(fitDisplayEdge(4000, 2000, CANVAS_DISPLAY_MAX_EDGE)).toEqual({ width: 256, height: 128 })
    expect(fitDisplayEdge(120, 80, 256)).toEqual({ width: 120, height: 80 })
    expect(fitDisplayEdge(0, 10)).toEqual({ width: 1, height: 1 })
  })
})

describe('display decode limiter', () => {
  it('runs one card downsample at a time', async () => {
    const limit = createAsyncLimiter(1)
    let active = 0
    let maxActive = 0
    const task = () => limit(async () => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
    })
    await Promise.all([task(), task(), task()])
    expect(maxActive).toBe(1)
  })

  it('drops a queued decode when the card unmounts', async () => {
    const limit = createAsyncLimiter(1)
    let releaseGate: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve
    })
    const first = limit(() => gate.then(() => 'first'))
    const controller = new AbortController()
    const second = limit(async () => 'second', controller.signal)
    controller.abort()
    await expect(second).rejects.toMatchObject({ name: 'AbortError' })
    releaseGate()
    await expect(first).resolves.toBe('first')
  })
})

describe('revokeCanvasObjectUrl', () => {
  it('revokes blob urls and ignores asset urls', () => {
    const revoked: string[] = []
    const original = URL.revokeObjectURL
    URL.revokeObjectURL = (value: string) => {
      revoked.push(String(value))
    }
    try {
      revokeCanvasObjectUrl('blob:http://local/1')
      revokeCanvasObjectUrl('https://cdn.example/full.png')
      revokeCanvasObjectUrl('')
      expect(revoked).toEqual(['blob:http://local/1'])
    } finally {
      URL.revokeObjectURL = original
    }
  })
})
