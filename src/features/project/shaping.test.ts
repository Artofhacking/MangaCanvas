import { describe, expect, it } from 'vitest'
import {
  evaluateStoryboardGate,
  foreignShotSceneNames,
  generationCover,
  lockedPromptLine,
  storyboardDependencyAssets,
} from './shaping'

const characters = [
  { id: 1, name: '林深', description: '黑大衣', shapingStatus: 'unset' as const, image: 'a.png', hasImage: true },
  { id: 2, name: '苏晚', description: '短发', shapingStatus: 'semi' as const, image: 'b.png', hasImage: false },
  { id: 3, name: '青羽', description: '白衣', shapingStatus: 'final' as const, image: 'c.png', hasImage: true },
]

const scenes = [
  { id: 8, name: '夜诊所', description: '冷白灯', shapingStatus: 'semi' as const, image: '', hasImage: false },
]

const objects = [
  { id: 4, name: '铁钥匙', description: '黄铜', shapingStatus: 'unset' as const },
  { id: 5, name: '黑伞', description: '湿伞', shapingStatus: 'final' as const, image: 'umbrella.png', hasImage: true },
]

describe('storyboardDependencyAssets', () => {
  it('uses episode cast plus shot links and named props', () => {
    const assets = storyboardDependencyAssets({
      episodeCharacterIds: [1],
      episodeSceneIds: [8],
      episodeObjectIds: [4],
      shots: [{ characterIds: [3], sceneId: null, prompt: '她撑着黑伞' }],
      characters,
      scenes,
      objects,
    })
    expect(assets.map((item) => item.name).sort()).toEqual(['夜诊所', '林深', '青羽', '铁钥匙', '黑伞'].sort())
  })

  it('is empty when the episode and shots reference nothing', () => {
    expect(
      storyboardDependencyAssets({
        shots: [{ prompt: '空镜' }],
        characters,
        scenes,
        objects,
      })
    ).toEqual([])
  })

  it('keeps another episode scene out of the lock list and names it separately', () => {
    const cafe = { id: 34, name: '街角咖啡馆', description: '玻璃窗', shapingStatus: 'unset' as const }
    const assets = storyboardDependencyAssets({
      episodeCharacterIds: [1],
      episodeSceneIds: [8],
      episodeObjectIds: [4],
      shots: [{ characterIds: [1], sceneId: 34, prompt: '' }],
      characters,
      scenes: [...scenes, cafe],
      objects,
    })
    expect(assets.map((item) => item.name)).not.toContain('街角咖啡馆')
    expect(assets.map((item) => item.name).sort()).toEqual(['夜诊所', '林深', '铁钥匙'].sort())
    expect(
      foreignShotSceneNames({
        episodeSceneIds: [8],
        shots: [{ sceneId: 34 }],
        scenes: [...scenes, cafe],
      })
    ).toEqual(['街角咖啡馆'])
    const gate = evaluateStoryboardGate(assets)
    expect(gate.blockedMessage).toContain('林深')
    expect(gate.blockedMessage).not.toContain('街角咖啡馆')
  })
})

describe('evaluateStoryboardGate', () => {
  it('blocks while any dependency is unset', () => {
    const gate = evaluateStoryboardGate([characters[0], characters[1]])
    expect(gate.blocked).toBe(true)
    expect(gate.blockedMessage).toContain('先锁定提示词或定妆')
    expect(gate.blockedMessage).toContain('林深')
    expect(gate.semiHint).toBeNull()
  })

  it('allows generation and warns when everyone is at least semi', () => {
    const gate = evaluateStoryboardGate([characters[1], scenes[0], characters[2]])
    expect(gate.blocked).toBe(false)
    expect(gate.semiHint).toContain('尚未定妆，仅按提示词约束')
    expect(gate.semiHint).toContain('苏晚')
    expect(gate.semiHint).not.toContain('青羽')
  })

  it('does not block an empty dependency set', () => {
    expect(evaluateStoryboardGate([]).blocked).toBe(false)
  })
})

describe('generation context', () => {
  it('sends covers only for finalized assets and locked prompts for semi and final', () => {
    expect(generationCover(characters[0])).toBeUndefined()
    expect(generationCover(characters[1])).toBeUndefined()
    expect(generationCover(characters[2])).toBe('c.png')
    expect(lockedPromptLine(characters[0])).toBeNull()
    expect(lockedPromptLine(characters[1])).toBe('苏晚：短发')
    expect(lockedPromptLine(characters[2])).toBe('青羽：白衣')
  })
})
