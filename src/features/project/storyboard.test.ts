import { describe, expect, it } from 'vitest'
import {
  buildShotPrompt,
  collectShotReferenceImages,
  createStoryboardShot,
  normalizeStoryboard,
  persistableStoryboard,
  pickStoryboardModel,
  shotsFromEpisodeScript,
  splitEpisodeScript,
  storyboardUsesReferenceImages,
} from './storyboard'

describe('normalizeStoryboard', () => {
  it('renumbers rows and clears stale generating status', () => {
    const shots = normalizeStoryboard([
      { id: 'a', prompt: '门口', characterIds: ['1'], imageUrl: '/static/a.png', status: 'generating' },
      { prompt: '第二镜', status: 'failed', error: 'timeout' },
    ])
    expect(shots[0].index).toBe(1)
    expect(shots[0].characterIds).toEqual([1])
    expect(shots[0].status).toBe('ready')
    expect(shots[1].index).toBe(2)
    expect(shots[1].status).toBe('failed')
  })
})

describe('persistableStoryboard', () => {
  it('does not persist in-flight generating as a stuck status', () => {
    const shot = createStoryboardShot(1, '对峙')
    expect(persistableStoryboard([{ ...shot, status: 'generating' }])[0].status).toBe('empty')
  })
})

describe('splitEpisodeScript', () => {
  it('splits blank-line beats into shot prompts', () => {
    expect(splitEpisodeScript('青羽推门。\n\n赤烬拔剑。')).toEqual(['青羽推门。', '赤烬拔剑。'])
  })

  it('splits scene headings', () => {
    const rows = splitEpisodeScript('第一场 书院门口\n青羽站着。\n第二场 后山\n雾气散开。')
    expect(rows).toHaveLength(2)
    expect(rows[1]).toContain('后山')
  })
})

describe('shotsFromEpisodeScript', () => {
  it('links character and scene names found in the beat', () => {
    const shots = shotsFromEpisodeScript('青羽走进雾隐后山。', {
      characters: [{ id: 7, name: '青羽' }],
      scenes: [{ id: 3, name: '雾隐后山' }],
    })
    expect(shots).toHaveLength(1)
    expect(shots[0].characterIds).toEqual([7])
    expect(shots[0].sceneId).toBe(3)
  })
})

describe('collectShotReferenceImages / prompt', () => {
  const catalog = {
    characters: [
      {
        id: 1,
        name: '青羽',
        image: 'https://cdn.example/qingyu.png',
        hasImage: true,
        role: '主角' as const,
        style: '',
        scenes: 0,
      },
    ],
    scenes: [
      {
        id: 2,
        name: '后山',
        image: 'https://cdn.example/hill.png',
        hasImage: true,
        status: 'in-use' as const,
        modified: '',
        code: 'SC_002',
      },
    ],
  }

  it('collects linked character and scene images', () => {
    expect(
      collectShotReferenceImages(
        { ...createStoryboardShot(1), characterIds: [1], sceneId: 2 },
        catalog
      )
    ).toEqual(['https://cdn.example/qingyu.png', 'https://cdn.example/hill.png'])
  })

  it('appends 角色/场景 names to the generate prompt', () => {
    expect(
      buildShotPrompt({ ...createStoryboardShot(1, '拔剑'), characterIds: [1], sceneId: 2 }, catalog)
    ).toBe('拔剑\n角色：青羽\n场景：后山')
  })
})

describe('pickStoryboardModel', () => {
  it('uses i2i only when refs exist', () => {
    expect(pickStoryboardModel(true, ['wan2.6-t2i', 'wan2.6-image'])).toBe('wan2.6-image')
    expect(pickStoryboardModel(false, ['wan2.6-t2i', 'wan2.6-image'])).toBe('wan2.6-t2i')
    expect(storyboardUsesReferenceImages('wan2.6-image')).toBe(true)
    expect(storyboardUsesReferenceImages('wan2.6-t2i')).toBe(false)
  })
})
