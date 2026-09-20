import { describe, expect, it } from 'vitest'
import {
  buildCollectMetadata,
  collectCategoryLabel,
  collectFavoritedAt,
  inferCollectMediaType,
  isCollectedAsset,
  isCollectedMetadata,
} from './favorites'

describe('collect metadata marker', () => {
  it('marks star-flow saves with source=favorite and favoritedAt', () => {
    const marked = buildCollectMetadata(
      { category: 'scene', mediaType: 'image' },
      true,
      '2026-09-20T05:00:00.000Z',
    )
    expect(marked).toEqual({
      category: 'scene',
      mediaType: 'image',
      source: 'favorite',
      favoritedAt: '2026-09-20T05:00:00.000Z',
    })
    expect(isCollectedMetadata(marked)).toBe(true)
  })

  it('does not mark ordinary material saves as collected', () => {
    const plain = buildCollectMetadata({ category: 'object', nodeId: 'n1' }, false)
    expect(plain).toEqual({ category: 'object', nodeId: 'n1' })
    expect(isCollectedMetadata(plain)).toBe(false)
    expect(isCollectedAsset({ metadata: plain })).toBe(false)
  })

  it('treats collect source or favoritedAt as a collected item', () => {
    expect(isCollectedAsset({ metadata: { source: 'collect' } })).toBe(true)
    expect(isCollectedAsset({ metadata: { favoritedAt: '2026-09-20T05:00:00.000Z' } })).toBe(true)
    expect(isCollectedAsset({ metadata: { status: 'approved' } })).toBe(false)
    expect(isCollectedAsset({ metadata: null })).toBe(false)
  })

  it('reads category, media type and favorited time from metadata', () => {
    expect(collectCategoryLabel('character')).toBe('人物')
    expect(collectCategoryLabel('unknown')).toBe('素材')
    expect(inferCollectMediaType('/static/a.png', { mediaType: 'video' })).toBe('video')
    expect(inferCollectMediaType('https://cdn.example/clip.mp4')).toBe('video')
    expect(inferCollectMediaType('https://cdn.example/still.png')).toBe('image')
    expect(collectFavoritedAt({ favoritedAt: '2026-09-20T05:00:00.000Z' })).toBe('2026-09-20T05:00:00.000Z')
  })
})
