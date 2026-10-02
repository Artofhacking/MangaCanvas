import { describe, expect, it } from 'vitest'
import {
  isProjectVideoAsset,
  materialCategoryOptions,
  normalizeMaterialCategory,
  toProjectVideo,
} from './projectVideos'

describe('isProjectVideoAsset', () => {
  it('keeps canvas saves marked as video, including older category rows', () => {
    expect(isProjectVideoAsset({ url: 'https://cdn.example/a', metadata: { category: 'video', mediaType: 'video' } })).toBe(true)
    expect(isProjectVideoAsset({ url: 'https://cdn.example/clip', metadata: { category: 'object', mediaType: 'video' } })).toBe(true)
    expect(isProjectVideoAsset({ url: 'https://cdn.example/clip.mp4', metadata: { category: 'scene' } })).toBe(true)
    expect(isProjectVideoAsset({ url: '/static/uploads/assets/take.webm?token=1', metadata: null })).toBe(true)
  })

  it('leaves stills out of the video library', () => {
    expect(isProjectVideoAsset({ url: 'https://cdn.example/cover.png', metadata: { category: 'character', mediaType: 'image' } })).toBe(false)
    expect(isProjectVideoAsset({ url: '', metadata: { category: 'object' } })).toBe(false)
    expect(isProjectVideoAsset({ url: 'https://cdn.example/note', metadata: null })).toBe(false)
  })
})

describe('toProjectVideo', () => {
  it('uses the asset name and prompt', () => {
    expect(toProjectVideo({
      id: 7,
      name: ' 雨夜 ',
      url: 'https://cdn.example/rain.mp4',
      prompt: ' 推近 ',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-02T00:00:00.000Z',
      metadata: { mediaType: 'video' },
    })).toMatchObject({
      id: 7,
      name: '雨夜',
      prompt: '推近',
      url: 'https://cdn.example/rain.mp4',
    })
  })

  it('drops rows that are not videos', () => {
    expect(toProjectVideo({ id: 1, name: '封面', url: 'https://cdn.example/a.png', metadata: { mediaType: 'image' } })).toBeNull()
  })
})

describe('normalizeMaterialCategory', () => {
  it('defaults a canvas video save to the video library', () => {
    expect(normalizeMaterialCategory(undefined, 'video')).toBe('video')
    expect(normalizeMaterialCategory('videoConfig', 'video')).toBe('video')
    expect(normalizeMaterialCategory('character', 'video')).toBe('character')
    expect(normalizeMaterialCategory('video', 'image')).toBe('object')
    expect(materialCategoryOptions('video').map((item) => item.value)).toEqual(['video', 'character', 'scene', 'object'])
    expect(materialCategoryOptions('image').map((item) => item.value)).toEqual(['character', 'scene', 'object'])
  })
})
