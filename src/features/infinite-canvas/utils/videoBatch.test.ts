import { describe, expect, it } from 'vitest'
import { collectVideoBatch } from './videoBatch'

describe('collectVideoBatch', () => {
  it('keeps successes in request order and drops failed slots', async () => {
    const finished: number[] = []
    const result = await collectVideoBatch({
      count: 4,
      onProgress: (done) => finished.push(done),
      run: async (index) => {
        if (index === 1) throw new Error('上游拒绝')
        if (index === 2) return '  '
        return `https://cdn.example/${index}.mp4`
      },
    })

    expect(result.urls).toEqual([
      'https://cdn.example/0.mp4',
      'https://cdn.example/3.mp4',
    ])
    expect(result.rateLimited).toBe(false)
    expect(result.errorMessage).toBe('上游拒绝')
    expect(finished[finished.length - 1]).toBe(4)
  })

  it('flags a rate limit without dropping clips that already succeeded', async () => {
    const result = await collectVideoBatch({
      count: 2,
      run: async (index) => {
        if (index === 0) throw new Error('API_RATE_LIMIT')
        return 'https://cdn.example/b.mp4'
      },
    })

    expect(result.urls).toEqual(['https://cdn.example/b.mp4'])
    expect(result.rateLimited).toBe(true)
  })

  it('aborts the batch when the signal is already cancelled', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(collectVideoBatch({
      count: 2,
      signal: controller.signal,
      run: async () => 'https://cdn.example/a.mp4',
    })).rejects.toMatchObject({ name: 'AbortError' })
  })
})
