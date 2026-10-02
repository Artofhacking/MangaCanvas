import { describe, expect, it } from 'vitest'
import { buildEpisodeDelivery, deliveryFilename, deliveryManifestFilename } from './delivery'
import { clearShotFinal, createStoryboardShot, finalizeShot, normalizeStoryboard } from './storyboard'
import type { StoryboardShot } from '@/types'

function shot(partial: Partial<StoryboardShot> & Pick<StoryboardShot, 'id' | 'index'>): StoryboardShot {
  return {
    prompt: '',
    characterIds: [],
    status: 'empty',
    ...partial,
  }
}

describe('buildEpisodeDelivery', () => {
  it('packs finalized shots in 镜号 order and lists the rest as gaps', () => {
    const delivery = buildEpisodeDelivery({
      id: 9,
      name: '雾城夜戏',
      code: 'EP_01',
      storyboard: [
        shot({ id: 'c', index: 3, prompt: '收剑', status: 'ready', imageUrl: '/static/c.png', finalized: true, finalizedImageUrl: '/static/c.png' }),
        shot({ id: 'a', index: 1, prompt: '推门', status: 'ready', imageUrl: '/static/a.png' }),
        shot({ id: 'b', index: 2, prompt: '对峙', status: 'empty' }),
        shot({ id: 'd', index: 4, prompt: '空定稿', status: 'ready', finalized: true }),
      ],
    })

    expect(delivery.items.map((item) => item.shotNumber)).toEqual([3])
    expect(delivery.items[0]).toMatchObject({
      shotId: 'c',
      filename: 'EP_01_镜03.png',
      fileUrl: '/static/c.png',
      prompt: '收剑',
    })
    expect(delivery.gaps).toEqual([
      { shotId: 'a', shotNumber: 1, prompt: '推门', reason: 'unfinalized' },
      { shotId: 'b', shotNumber: 2, prompt: '对峙', reason: 'no-frame' },
      { shotId: 'd', shotNumber: 4, prompt: '空定稿', reason: 'missing-file' },
    ])
    expect(delivery.export).toEqual({
      format: 'manifest',
      zip: false,
      note: '按镜号排列的定稿文件地址。zip 打包留待后续。',
    })
  })

  it('keeps an empty episode as an empty package', () => {
    const delivery = buildEpisodeDelivery({ id: 1, name: '空集', code: 'EP_00', storyboard: [] })
    expect(delivery.items).toEqual([])
    expect(delivery.gaps).toEqual([])
    expect(deliveryManifestFilename(delivery)).toBe('EP_00-交付清单.json')
  })

  it('uses the frozen file after the current frame changes', () => {
    const base = {
      ...createStoryboardShot(1, '门口'),
      imageUrl: '/static/take-1.png',
      status: 'ready' as const,
    }
    const locked = finalizeShot(base, '2026-10-02T00:00:00.000Z')
    const regenerated: StoryboardShot = { ...locked, imageUrl: '/static/take-2.png' }
    const delivery = buildEpisodeDelivery({
      id: 2,
      name: '第一集',
      code: '第1集',
      storyboard: [regenerated],
    })
    expect(delivery.items[0].fileUrl).toBe('/static/take-1.png')
    expect(delivery.items[0].filename).toBe('第1集_镜01.png')
    expect(delivery.items[0].finalizedAt).toBe('2026-10-02T00:00:00.000Z')
    expect(delivery.gaps).toEqual([])
  })

  it('drops a shot from the package when 定稿 is cleared', () => {
    const locked = finalizeShot(
      { ...createStoryboardShot(1, '门口'), imageUrl: '/static/a.jpg', status: 'ready' },
      '2026-10-02T00:00:00.000Z'
    )
    const delivery = buildEpisodeDelivery({
      id: 2,
      name: '第一集',
      code: 'EP1',
      storyboard: [clearShotFinal(locked)],
    })
    expect(delivery.items).toEqual([])
    expect(delivery.gaps[0].reason).toBe('unfinalized')
  })
})

describe('deliveryFilename', () => {
  it('reads a safe extension and falls back to png', () => {
    expect(deliveryFilename('EP 01', 12, 'https://cdn.example.com/x.JPEG?token=1')).toBe('EP_01_镜12.jpeg')
    expect(deliveryFilename('  ', 1, '/static/noext')).toBe('episode_镜01.png')
  })
})

describe('normalizeStoryboard finalized fields', () => {
  it('keeps a finalized take and ignores a flag with no file', () => {
    const shots = normalizeStoryboard([
      {
        id: 'a',
        prompt: '门口',
        imageUrl: '/static/a.png',
        finalized: true,
        finalizedImageUrl: '/static/locked.png',
        finalizedAt: '2026-10-02T00:00:00.000Z',
        status: 'ready',
      },
      { id: 'b', prompt: '空', finalized: true, status: 'empty' },
    ])
    expect(shots[0].finalized).toBe(true)
    expect(shots[0].finalizedImageUrl).toBe('/static/locked.png')
    expect(shots[0].finalizedAt).toBe('2026-10-02T00:00:00.000Z')
    expect(shots[1].finalized).toBe(false)
    expect(shots[1].finalizedImageUrl).toBeUndefined()
  })
})
