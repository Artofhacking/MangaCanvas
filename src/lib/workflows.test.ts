import { describe, expect, it } from 'vitest'
import { PLACEHOLDER_COVER_URL } from './assetSeed'
import { shouldRebuildEpisodeCanvas } from './plotActs'
import { buildSeedCanvas, shouldRepairAssetSeedCanvas, type OpenWorkflowOptions } from './workflows'

const base = (overrides: Partial<OpenWorkflowOptions>): OpenWorkflowOptions => ({
  projectId: '1',
  sourceType: 'character',
  sourceName: '青羽',
  sourceAssetId: 7,
  ...overrides,
})

describe('buildSeedCanvas asset media', () => {
  it('turns a prompt-only asset into a text node named after the asset', () => {
    const canvas = buildSeedCanvas(base({
      seedPrompt: '雾中持扇的水墨少年',
      seedImage: PLACEHOLDER_COVER_URL,
      seedHasImage: false,
    }))

    expect(canvas.nodes).toHaveLength(1)
    expect(canvas.nodes[0]).toMatchObject({
      type: 'text',
      data: { label: '青羽', content: '雾中持扇的水墨少年' },
    })
    expect(canvas.nodes.some((node) => node.type === 'image' || node.data.label === '分镜稿')).toBe(false)
  })

  it('treats a placeholder cover as no image even when the hasImage flag is omitted', () => {
    const canvas = buildSeedCanvas(base({
      sourceType: 'object',
      sourceName: '折扇',
      seedPrompt: '一柄纸扇',
      seedImage: PLACEHOLDER_COVER_URL,
    }))

    expect(canvas.nodes.map((node) => node.type)).toEqual(['text'])
    expect(canvas.nodes[0].data.label).toBe('折扇')
  })

  it('keeps the asset name when that name is 分镜稿, without inventing an image node', () => {
    const canvas = buildSeedCanvas(base({
      sourceType: 'object',
      sourceName: '分镜稿',
      seedPrompt: '第一镜：雨夜长街',
      seedHasImage: false,
      seedImage: PLACEHOLDER_COVER_URL,
    }))

    expect(canvas.nodes).toHaveLength(1)
    expect(canvas.nodes[0].type).toBe('text')
    expect(canvas.nodes[0].data).toMatchObject({
      label: '分镜稿',
      content: '第一镜：雨夜长街',
    })
  })

  it('creates an image node for a real cover and labels it with the asset name', () => {
    const canvas = buildSeedCanvas(base({
      seedImage: 'https://cdn.example/qingyu.png',
      seedHasImage: true,
    }))

    expect(canvas.nodes).toEqual([
      expect.objectContaining({
        id: 'seed_image',
        type: 'image',
        data: expect.objectContaining({
          label: '青羽',
          url: 'https://cdn.example/qingyu.png',
        }),
      }),
    ])
  })

  it('keeps a prompt text node beside a real image', () => {
    const canvas = buildSeedCanvas(base({
      seedPrompt: '雾中持扇',
      seedImage: 'https://cdn.example/qingyu.png',
      seedHasImage: true,
    }))

    expect(canvas.nodes.map((node) => [node.type, node.data.label])).toEqual([
      ['text', '提示词'],
      ['image', '青羽'],
    ])
    expect(canvas.edges).toEqual([{ id: 'seed_edge', source: 'seed_prompt', target: 'seed_image' }])
  })

  it('creates a video node from an explicit video url or a video file cover', () => {
    const fromField = buildSeedCanvas(base({
      sourceType: 'scene',
      sourceName: '夜雨',
      seedVideo: 'https://cdn.example/rain.mp4',
      seedMediaType: 'video',
    }))
    const fromCover = buildSeedCanvas(base({
      sourceType: 'scene',
      sourceName: '夜雨',
      seedImage: 'https://cdn.example/rain.webm?token=1',
      seedHasImage: true,
    }))

    expect(fromField.nodes).toEqual([
      expect.objectContaining({
        type: 'video',
        data: expect.objectContaining({ label: '夜雨', url: 'https://cdn.example/rain.mp4' }),
      }),
    ])
    expect(fromCover.nodes[0].type).toBe('video')
    expect(fromCover.nodes[0].data.url).toBe('https://cdn.example/rain.webm?token=1')
  })

  it('ignores blank or broken covers and falls through to the prompt', () => {
    for (const seedImage of ['', '   ', 'null', 'placeholder', 'broken']) {
      const canvas = buildSeedCanvas(base({ seedPrompt: '只有文字', seedImage }))
      expect(canvas.nodes.map((node) => node.type)).toEqual(['text'])
    }
  })

  it('leaves the canvas empty when the asset has neither usable media nor a prompt', () => {
    const canvas = buildSeedCanvas(base({
      seedImage: PLACEHOLDER_COVER_URL,
      seedHasImage: false,
    }))

    expect(canvas.nodes).toEqual([])
    expect(canvas.edges).toEqual([])
  })
})

describe('buildSeedCanvas episode plot', () => {
  it('uses a text node for a prompt-only related asset and an image node for a real cover', () => {
    const canvas = buildSeedCanvas({
      projectId: '1',
      sourceType: 'episode',
      sourceName: '第一集',
      seedPrompt: '青羽走进长街。',
      relatedAssets: [
        {
          id: 1,
          name: '青羽',
          category: 'character',
          prompt: '雾中持扇',
          image: PLACEHOLDER_COVER_URL,
          hasImage: false,
        },
        {
          id: 2,
          name: '长街',
          category: 'scene',
          image: 'https://cdn.example/street.png',
          hasImage: true,
        },
        {
          id: 3,
          name: '空道具',
          category: 'object',
          image: '',
        },
        {
          id: 4,
          name: '预告',
          category: 'object',
          video: 'https://cdn.example/teaser.mp4',
        },
      ],
    })

    const byId = Object.fromEntries(canvas.nodes.map((node) => [node.id, node]))
    expect(byId.seed_character_1).toMatchObject({
      type: 'text',
      data: { label: '青羽', content: '雾中持扇' },
    })
    expect(byId.seed_scene_2).toMatchObject({
      type: 'image',
      data: { label: '长街', url: 'https://cdn.example/street.png' },
    })
    expect(byId.seed_object_3).toBeUndefined()
    expect(byId.seed_object_4).toMatchObject({
      type: 'video',
      data: { label: '预告', url: 'https://cdn.example/teaser.mp4' },
    })
    expect(canvas.nodes.some((node) => node.type === 'image' && !node.data.url)).toBe(false)
    expect(canvas.nodes.some((node) => node.data.label === '分镜稿')).toBe(false)
  })
})

describe('seed canvas repair', () => {
  it('repairs an untouched image seed when the asset is prompt-only', () => {
    expect(shouldRepairAssetSeedCanvas(
      {
        nodes: [{
          id: 'seed_image',
          type: 'image',
          data: { url: PLACEHOLDER_COVER_URL, label: '分镜稿' },
        }],
      },
      base({ seedPrompt: '只有提示词', seedImage: PLACEHOLDER_COVER_URL, seedHasImage: false }),
    )).toBe(true)
  })

  it('leaves a matching text seed and any canvas the user already edited', () => {
    const options = base({ seedPrompt: '只有提示词', seedHasImage: false })
    expect(shouldRepairAssetSeedCanvas(
      { nodes: [{ id: 'seed_prompt', type: 'text', data: { content: '只有提示词' } }] },
      options,
    )).toBe(false)
    expect(shouldRepairAssetSeedCanvas(
      {
        nodes: [
          { id: 'seed_image', type: 'image', data: { url: PLACEHOLDER_COVER_URL } },
          { id: 'node_custom', type: 'text', data: {} },
        ],
      },
      options,
    )).toBe(false)
  })

  it('rebuilds an episode plot that still has an empty image seed', () => {
    expect(shouldRebuildEpisodeCanvas({
      nodes: [
        { id: 'act_1', type: 'text', data: { content: '短句', label: '第一幕' } },
        {
          id: 'seed_character_1',
          type: 'image',
          data: { url: '', label: '林深', sourceType: 'character', sourceAssetId: '1' },
        },
      ],
    })).toBe(true)

    expect(shouldRebuildEpisodeCanvas({
      nodes: [
        { id: 'act_1', type: 'text', data: { content: '短句', label: '第一幕' } },
        {
          id: 'seed_character_1',
          type: 'image',
          data: { url: 'https://cdn.example/lin.png', label: '林深', sourceType: 'character', sourceAssetId: '1' },
        },
      ],
    })).toBe(false)
  })
})
