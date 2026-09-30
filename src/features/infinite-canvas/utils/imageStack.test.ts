import { describe, expect, it } from 'vitest'
import {
  bringStackImageForward,
  buildGeneratedImageNodePatch,
  placeStackCandidates,
  readImageStack,
} from './imageStack'

describe('image stack', () => {
  it('keeps a single returned image as a normal node url', () => {
    const outcome = buildGeneratedImageNodePatch({
      urls: [' https://cdn.example/a.png '],
      requestedCount: 1,
      nodeId: 'node_1',
      now: 10,
    })

    expect(outcome.ok).toBe(true)
    expect(outcome.notice).toEqual({ level: 'success', text: '图片生成成功！' })
    expect(outcome.patch.url).toBe('https://cdn.example/a.png')
    expect(outcome.patch.imageUrls).toBeUndefined()
    expect(outcome.patch.activeImageIndex).toBeUndefined()
    expect(outcome.patch.loading).toBe(false)
    expect(outcome.patch.error).toBe('')
    expect(outcome.patch.outputNodeId).toBe('node_1')
    expect(readImageStack(outcome.patch).urls).toEqual(['https://cdn.example/a.png'])
  })

  it('stores every URL for n=2 and n=4 and puts the first one in front', () => {
    const two = buildGeneratedImageNodePatch({
      urls: ['https://cdn.example/a.png', 'https://cdn.example/b.png'],
      requestedCount: 2,
      nodeId: 'node_2',
    })
    expect(two.notice).toEqual({ level: 'success', text: '已生成 2 张图片' })
    expect(two.patch.url).toBe('https://cdn.example/a.png')
    expect(two.patch.imageUrls).toEqual([
      'https://cdn.example/a.png',
      'https://cdn.example/b.png',
    ])
    expect(two.patch.activeImageIndex).toBe(0)

    const four = ['a', 'b', 'c', 'd'].map((name) => `https://cdn.example/${name}.png`)
    const outcome = buildGeneratedImageNodePatch({
      urls: four,
      requestedCount: 4,
      nodeId: 'node_4',
    })
    expect(outcome.patch.imageUrls).toEqual(four)
    expect(outcome.patch.url).toBe(four[0])
    expect(outcome.notice.text).toBe('已生成 4 张图片')
  })

  it('drops blanks and duplicates, and warns when fewer images come back than requested', () => {
    const outcome = buildGeneratedImageNodePatch({
      urls: [' https://cdn.example/a.png ', '', 'https://cdn.example/a.png', 'https://cdn.example/b.png'],
      requestedCount: 4,
      nodeId: 'node_2',
    })

    expect(outcome.ok).toBe(true)
    expect(outcome.patch.imageUrls).toEqual([
      'https://cdn.example/a.png',
      'https://cdn.example/b.png',
    ])
    expect(outcome.patch.url).toBe('https://cdn.example/a.png')
    expect(outcome.notice).toEqual({
      level: 'warning',
      text: '已生成 2 张，少于请求的 4 张',
    })
  })

  it('keeps the previous image when nothing usable comes back', () => {
    const outcome = buildGeneratedImageNodePatch({
      urls: [' ', ''],
      requestedCount: 2,
      nodeId: 'node_2',
    })

    expect(outcome.ok).toBe(false)
    expect(outcome.patch).toEqual({ loading: false, error: '生成失败', progress: undefined })
    expect(outcome.notice).toEqual({ level: 'error', text: '生成失败' })
    expect(outcome.patch.url).toBeUndefined()
  })

  it('shows one image without stack chrome when only one of n URLs arrives', () => {
    const outcome = buildGeneratedImageNodePatch({
      urls: ['https://cdn.example/only.png'],
      requestedCount: 2,
      nodeId: 'node_2',
    })

    expect(outcome.patch.url).toBe('https://cdn.example/only.png')
    expect(outcome.patch.imageUrls).toBeUndefined()
    expect(outcome.notice.level).toBe('warning')
    expect(readImageStack(outcome.patch).urls).toHaveLength(1)
  })

  it('treats the node url as the front image for downstream readers', () => {
    const stack = readImageStack({
      url: 'https://cdn.example/b.png',
      imageUrls: [
        'https://cdn.example/a.png',
        'https://cdn.example/b.png',
        'https://cdn.example/c.png',
      ],
      activeImageIndex: 0,
    })

    expect(stack.activeIndex).toBe(1)
    expect(stack.urls[stack.activeIndex]).toBe('https://cdn.example/b.png')
  })

  it('brings a clicked candidate to the front without dropping the others', () => {
    const data = {
      url: 'https://cdn.example/a.png',
      imageUrls: [
        'https://cdn.example/a.png',
        'https://cdn.example/b.png',
        'https://cdn.example/c.png',
      ],
      activeImageIndex: 0,
    }

    expect(bringStackImageForward(data, 0)).toBeNull()
    expect(bringStackImageForward(data, 2)).toEqual({
      url: 'https://cdn.example/c.png',
      activeIndex: 2,
    })
    expect(bringStackImageForward({ url: 'https://cdn.example/a.png' }, 0)).toBeNull()

    const next = bringStackImageForward(data, 1)
    const stored = {
      ...data,
      url: next?.url,
      activeImageIndex: next?.activeIndex,
    }
    expect(readImageStack(stored)).toEqual({
      urls: data.imageUrls,
      activeIndex: 1,
    })
  })

  it('fans only the images behind the front one', () => {
    expect(placeStackCandidates(1, 0)).toEqual([])

    const two = placeStackCandidates(2, 0)
    expect(two.map((item) => item.index)).toEqual([1])
    expect(two[0]?.right).toBe(0)

    const four = placeStackCandidates(4, 2)
    expect(four.map((item) => item.index)).toEqual([0, 1, 3])
    expect(new Set(four.map((item) => item.index)).size).toBe(3)
    expect(four.some((item) => item.index === 2)).toBe(false)
    expect(Math.max(...four.map((item) => item.zIndex))).toBe(four[four.length - 1]?.zIndex)
  })
})
