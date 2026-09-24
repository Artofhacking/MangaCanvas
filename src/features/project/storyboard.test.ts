import { describe, expect, it } from 'vitest'
import {
  buildShotPrompt,
  collectShotReferenceImages,
  createStoryboardShot,
  matchAssetIds,
  normalizeStoryboard,
  persistableStoryboard,
  pickStoryboardModel,
  resolveShotSceneId,
  shotsFromEpisodeScript,
  splitEpisodeScript,
  storyboardSceneChoices,
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

const projectScenes = [
  { id: 34, name: '街角咖啡馆' },
  { id: 33, name: '出租屋客厅' },
]

const episodeOneScript = [
  '林夏推开老旧木门，狭小的出租屋只有一盏台灯亮着。窗缝里灌进冷风，桌面上摊着未写完的分镜稿。她把湿透的外套挂好，对镜子里的自己说：「明天还得交一版。」',
  '',
  '出场：林夏（女，二十多岁，黑发及肩，穿深蓝卫衣）',
  '场景：出租屋客厅（夜晚，台灯暖光，窗缝透风）',
  '物品：台灯、分镜稿',
].join('\n')

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

  it('binds every beat to the only scene of this episode', () => {
    const shots = shotsFromEpisodeScript(episodeOneScript, {
      characters: [
        { id: 34, name: '林夏' },
        { id: 35, name: '周衡' },
      ],
      scenes: projectScenes,
      episodeSceneIds: [33],
    })
    expect(shots.length).toBeGreaterThan(1)
    expect(shots.every((shot) => shot.sceneId === 33)).toBe(true)
    expect(shots.every((shot) => shot.prompt.trim().length > 0)).toBe(true)
    expect(shots[0].characterIds).toEqual([34])
    expect(shots.some((shot) => shot.prompt === '' && shot.sceneId === 34)).toBe(false)
  })

  it('does not bind another episode when its name is the only scene mentioned', () => {
    const shots = shotsFromEpisodeScript('林夏路过街角咖啡馆。', {
      characters: [{ id: 34, name: '林夏' }],
      scenes: projectScenes,
      episodeSceneIds: [33],
    })
    expect(shots).toHaveLength(1)
    expect(shots[0].sceneId).toBe(33)
  })
})

describe('resolveShotSceneId', () => {
  it('defaults a blank shot to the only episode scene, not the newest project scene', () => {
    expect(resolveShotSceneId('', projectScenes, [33])).toBe(33)
    expect(createStoryboardShot(1).sceneId).toBeNull()
    expect(matchAssetIds('', projectScenes)).toEqual([])
  })

  it('keeps a project-wide name list from choosing the first hit', () => {
    expect(
      matchAssetIds('街角咖啡馆的窗边，也能看见出租屋客厅的灯', projectScenes)
    ).toEqual([34, 33])
    expect(
      resolveShotSceneId('街角咖啡馆的窗边，也能看见出租屋客厅的灯', projectScenes, [33, 34])
    ).toBeNull()
    expect(resolveShotSceneId('她回到出租屋客厅。', projectScenes, [33, 34])).toBe(33)
  })

  it('limits the scene menu to this episode, in episode order', () => {
    expect(storyboardSceneChoices(projectScenes, [33]).map((scene) => scene.id)).toEqual([33])
    expect(storyboardSceneChoices(projectScenes, [33, 34]).map((scene) => scene.name)).toEqual([
      '出租屋客厅',
      '街角咖啡馆',
    ])
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
        description: '黑发少年',
        shapingStatus: 'final' as const,
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
        description: '雾气',
        shapingStatus: 'final' as const,
      },
    ],
  }

  it('collects finalized character and scene covers', () => {
    expect(
      collectShotReferenceImages(
        { ...createStoryboardShot(1), characterIds: [1], sceneId: 2 },
        catalog
      )
    ).toEqual(['https://cdn.example/qingyu.png', 'https://cdn.example/hill.png'])
  })

  it('keeps semi assets as locked prompt text and skips their covers', () => {
    const semiCatalog = {
      ...catalog,
      scenes: [{ ...catalog.scenes[0], shapingStatus: 'semi' as const, hasImage: false }],
    }
    expect(
      collectShotReferenceImages(
        { ...createStoryboardShot(1), characterIds: [1], sceneId: 2 },
        semiCatalog
      )
    ).toEqual(['https://cdn.example/qingyu.png'])
    expect(
      buildShotPrompt({ ...createStoryboardShot(1, '拔剑'), characterIds: [1], sceneId: 2 }, semiCatalog)
    ).toBe('拔剑\n角色：青羽\n场景：后山\n定型约束：\n青羽：黑发少年\n后山：雾气')
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
