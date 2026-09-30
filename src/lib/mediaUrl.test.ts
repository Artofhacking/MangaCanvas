import { afterEach, describe, expect, it, vi } from 'vitest'
import { rewriteCanvasMedia } from './mediaUrl'

describe('rewriteCanvasMedia', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rewrites stacked image urls the same way as the front url', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://app.example', href: 'https://app.example/' },
    })

    const canvas = rewriteCanvasMedia({
      nodes: [{
        data: {
          url: '/static/a.png',
          imageUrls: ['/static/a.png', 'https://cdn.example/b.png', 2],
        },
      }],
    })

    expect(canvas.nodes[0].data.url).toBe('https://app.example/static/a.png')
    expect(canvas.nodes[0].data.imageUrls).toEqual([
      'https://app.example/static/a.png',
      'https://cdn.example/b.png',
      2,
    ])
  })
})
