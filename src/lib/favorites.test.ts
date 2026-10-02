import { describe, expect, it } from 'vitest'
import {
  buildCollectMetadata,
  collectCategoryLabel,
  collectFavoritedAt,
  favoriteSourceId,
  inferCollectMediaType,
  isCollectedAsset,
  isCollectedMetadata,
  isSameFavoriteTarget,
  stripCollectMetadata,
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

  it('matches preview urls to stored assets and strips the favorite mark', () => {
    const stored = {
      url: '/static/uploads/generated/still.png',
      metadata: {
        source: 'favorite',
        favoritedAt: '2026-09-20T05:00:00.000Z',
        nodeId: 'node_1',
        mediaType: 'image',
        category: 'scene',
      },
    }
    expect(
      isSameFavoriteTarget(stored, {
        url: 'https://app.example/static/uploads/generated/still.png?token=1',
        nodeId: 'node_1',
      }),
    ).toBe(true)
    expect(isSameFavoriteTarget(stored, { url: stored.url, nodeId: 'node_2' })).toBe(false)
    expect(
      isSameFavoriteTarget(
        {
          url: '/static/uploads/generated/gen_a.mp4',
          metadata: { nodeId: 'node_1', sourceUrl: 'https://cdn.example/clip.mp4?sig=1' },
        },
        { url: 'https://cdn.example/clip.mp4?sig=2', nodeId: 'node_1' },
      ),
    ).toBe(true)
    expect(stripCollectMetadata(stored.metadata)).toEqual({
      nodeId: 'node_1',
      mediaType: 'image',
      category: 'scene',
    })
    expect(isCollectedMetadata('{"source":"favorite","mediaType":"video"}')).toBe(true)
    const sourceId = favoriteSourceId('node_1', stored.url)
    expect(sourceId.length).toBeLessThanOrEqual(64)
    expect(favoriteSourceId('node_1', 'https://app.example' + stored.url)).toBe(sourceId)
  })

  it('reads category, media type and favorited time from metadata', () => {
    expect(collectCategoryLabel('character')).toBe('角色')
    expect(collectCategoryLabel('unknown')).toBe('素材')
    expect(inferCollectMediaType('/static/a.png', { mediaType: 'video' })).toBe('video')
    expect(inferCollectMediaType('https://cdn.example/clip.mp4')).toBe('video')
    expect(inferCollectMediaType('https://cdn.example/still.png')).toBe('image')
    expect(collectFavoritedAt({ favoritedAt: '2026-09-20T05:00:00.000Z' })).toBe('2026-09-20T05:00:00.000Z')
  })
})
