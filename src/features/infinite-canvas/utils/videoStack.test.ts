import { describe, expect, it } from 'vitest'
import {
  bringStackVideoForward,
  buildGeneratedVideoNodePatch,
  readVideoStack,
  videoStackActivationPatch,
} from './videoStack'

describe('video stack', () => {
  it('keeps a single returned clip as a normal node url', () => {
    const outcome = buildGeneratedVideoNodePatch({
      urls: [' https://cdn.example/a.mp4 '],
      posters: [' https://cdn.example/a.jpg '],
      requestedCount: 1,
      nodeId: 'node_1',
      now: 10,
    })

    expect(outcome.ok).toBe(true)
    expect(outcome.notice).toEqual({ level: 'success', text: '视频生成完成！' })
    expect(outcome.patch.url).toBe('https://cdn.example/a.mp4')
    expect(outcome.patch.thumbnail).toBe('https://cdn.example/a.jpg')
    expect(outcome.patch.videoUrls).toBeUndefined()
    expect(outcome.patch.thumbnailUrls).toBeUndefined()
    expect(outcome.patch.activeVideoIndex).toBeUndefined()
    expect(outcome.patch.loading).toBe(false)
    expect(outcome.patch.error).toBe('')
    expect(outcome.patch.outputNodeId).toBe('node_1')
    expect(readVideoStack(outcome.patch).urls).toEqual(['https://cdn.example/a.mp4'])
  })

  it('stores every URL for n=2 and n=4 and puts the first one in front', () => {
    const two = buildGeneratedVideoNodePatch({
      urls: ['https://cdn.example/a.mp4', 'https://cdn.example/b.mp4'],
      posters: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
      requestedCount: 2,
      nodeId: 'node_2',
    })
    expect(two.notice).toEqual({ level: 'success', text: '已生成 2 条视频' })
    expect(two.patch.url).toBe('https://cdn.example/a.mp4')
    expect(two.patch.videoUrls).toEqual([
      'https://cdn.example/a.mp4',
      'https://cdn.example/b.mp4',
    ])
    expect(two.patch.thumbnailUrls).toEqual([
      'https://cdn.example/a.jpg',
      'https://cdn.example/b.jpg',
    ])
    expect(two.patch.activeVideoIndex).toBe(0)
    expect(two.patch.thumbnail).toBe('https://cdn.example/a.jpg')

    const four = ['a', 'b', 'c', 'd'].map((name) => `https://cdn.example/${name}.mp4`)
    const outcome = buildGeneratedVideoNodePatch({
      urls: four,
      requestedCount: 4,
      nodeId: 'node_4',
    })
    expect(outcome.patch.videoUrls).toEqual(four)
    expect(outcome.patch.url).toBe(four[0])
    expect(outcome.patch.thumbnailUrls).toBeUndefined()
    expect(outcome.notice.text).toBe('已生成 4 条视频')
  })

  it('drops blanks and duplicates, and warns when fewer clips come back than requested', () => {
    const outcome = buildGeneratedVideoNodePatch({
      urls: [' https://cdn.example/a.mp4 ', '', 'https://cdn.example/a.mp4', 'https://cdn.example/b.mp4'],
      posters: ['https://cdn.example/a.jpg', 'gone', 'dup', 'https://cdn.example/b.jpg'],
      requestedCount: 4,
      nodeId: 'node_2',
    })

    expect(outcome.ok).toBe(true)
    expect(outcome.patch.videoUrls).toEqual([
      'https://cdn.example/a.mp4',
      'https://cdn.example/b.mp4',
    ])
    expect(outcome.patch.thumbnailUrls).toEqual([
      'https://cdn.example/a.jpg',
      'https://cdn.example/b.jpg',
    ])
    expect(outcome.patch.url).toBe('https://cdn.example/a.mp4')
    expect(outcome.notice).toEqual({
      level: 'warning',
      text: '已生成 2 条，少于请求的 4 条',
    })
  })

  it('keeps the previous video when nothing usable comes back', () => {
    const outcome = buildGeneratedVideoNodePatch({
      urls: [' ', ''],
      requestedCount: 2,
      nodeId: 'node_2',
    })

    expect(outcome.ok).toBe(false)
    expect(outcome.patch).toEqual({
      loading: false,
      error: '生成失败',
      progress: undefined,
      statusLabel: undefined,
    })
    expect(outcome.notice).toEqual({ level: 'error', text: '生成失败' })
    expect(outcome.patch.url).toBeUndefined()
    expect(outcome.patch.videoUrls).toBeUndefined()
  })

  it('shows one clip without stack chrome when only one of n URLs arrives', () => {
    const outcome = buildGeneratedVideoNodePatch({
      urls: ['https://cdn.example/only.mp4'],
      requestedCount: 4,
      nodeId: 'node_2',
    })

    expect(outcome.patch.url).toBe('https://cdn.example/only.mp4')
    expect(outcome.patch.videoUrls).toBeUndefined()
    expect(outcome.notice).toEqual({
      level: 'warning',
      text: '已生成 1 条，少于请求的 4 条',
    })
    expect(readVideoStack(outcome.patch).urls).toHaveLength(1)
  })

  it('treats the node url as the front clip for downstream readers', () => {
    const stack = readVideoStack({
      url: 'https://cdn.example/b.mp4',
      videoUrls: [
        'https://cdn.example/a.mp4',
        'https://cdn.example/b.mp4',
        'https://cdn.example/c.mp4',
      ],
      thumbnailUrls: ['a.jpg', 'b.jpg', 'c.jpg'],
      activeVideoIndex: 0,
    })

    expect(stack.activeIndex).toBe(1)
    expect(stack.urls[stack.activeIndex]).toBe('https://cdn.example/b.mp4')
    expect(stack.thumbnails[1]).toBe('b.jpg')
  })

  it('brings a clicked candidate to the front without dropping the others', () => {
    const data = {
      url: 'https://cdn.example/a.mp4',
      videoUrls: [
        'https://cdn.example/a.mp4',
        'https://cdn.example/b.mp4',
        'https://cdn.example/c.mp4',
      ],
      thumbnailUrls: ['a.jpg', 'b.jpg', ''],
      activeVideoIndex: 0,
    }

    expect(bringStackVideoForward(data, 0)).toBeNull()
    expect(bringStackVideoForward(data, 2)).toEqual({
      url: 'https://cdn.example/c.mp4',
      activeIndex: 2,
      thumbnail: undefined,
    })
    expect(bringStackVideoForward({ url: 'https://cdn.example/a.mp4' }, 0)).toBeNull()

    const patch = videoStackActivationPatch(data, 1)
    expect(patch?.url).toBe('https://cdn.example/b.mp4')
    expect(patch?.activeVideoIndex).toBe(1)
    expect(patch?.thumbnail).toBe('b.jpg')
    expect(patch?.videoUrls).toBeUndefined()

    const stored = {
      ...data,
      url: patch?.url,
      activeVideoIndex: patch?.activeIndex,
      thumbnail: patch?.thumbnail,
    }
    expect(readVideoStack(stored)).toEqual({
      urls: data.videoUrls,
      thumbnails: ['a.jpg', 'b.jpg', ''],
      activeIndex: 1,
    })
  })
})
