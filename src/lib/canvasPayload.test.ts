import { describe, expect, it, vi } from 'vitest'
import {
  applyInlineReplacements,
  canvasSignature,
  collectInlineReplacements,
  graphHasInlineMedia,
  isInlineCanvasMedia,
} from './canvasPayload'

const PNG = 'data:image/png;base64,AAAA'
const STORED = '/static/uploads/generated/shot.png'

describe('canvas inline media', () => {
  it('treats image data URLs and blob URLs as inline, and leaves file URLs alone', () => {
    expect(isInlineCanvasMedia(PNG)).toBe(true)
    expect(isInlineCanvasMedia('blob:http://localhost/1')).toBe(true)
    expect(isInlineCanvasMedia('data:text/plain,hello')).toBe(false)
    expect(isInlineCanvasMedia(STORED)).toBe(false)
    expect(graphHasInlineMedia({ nodes: [{ data: { url: STORED } }] })).toBe(false)
    expect(graphHasInlineMedia({ nodes: [{ data: { url: PNG } }] })).toBe(true)
  })

  it('uploads one shared bitmap and drops the duplicate base64 field', async () => {
    const upload = vi.fn(async () => STORED)
    const graph = {
      nodes: [
        { id: 'a', data: { url: PNG, base64: PNG, label: '上传图片' } },
        { id: 'b', data: { url: PNG, prompt: 'keep' } },
      ],
      edges: [],
      viewport: { x: 1, y: 2, zoom: 0.5 },
    }
    const replacements = await collectInlineReplacements(graph, upload)
    const saved = applyInlineReplacements(graph, replacements)

    expect(upload).toHaveBeenCalledTimes(1)
    expect(saved.nodes[0].data).toEqual({ url: STORED, label: '上传图片' })
    expect(saved.nodes[1].data).toEqual({ url: STORED, prompt: 'keep' })
    expect(JSON.stringify(saved)).not.toContain('data:image')
  })

  it('promotes a lone base64 bitmap onto url', () => {
    const saved = applyInlineReplacements(
      { data: { base64: PNG, label: '只有底图' } },
      new Map([[PNG, STORED]]),
    )
    expect(saved).toEqual({ data: { url: STORED, label: '只有底图' } })
  })

  it('fingerprints inline bytes without embedding them', () => {
    const heavy = `data:image/png;base64,${'A'.repeat(5000)}`
    const signature = canvasSignature({
      nodes: [{ id: 'n', data: { url: heavy } }],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    })
    expect(signature).not.toContain(heavy)
    expect(signature.length).toBeLessThan(500)
    const other = canvasSignature({
      nodes: [{ id: 'n', data: { url: `data:image/png;base64,${'B'.repeat(5000)}` } }],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    })
    expect(other).not.toBe(signature)
  })
})
