import { isI2IModel } from '@/api/aigc'
import type { Character, ObjectItem, Scene, StoryboardShot, StoryboardShotStatus } from '@/types'
import { generationCover, lockedPromptLine } from '@/features/project/shaping'

const STATUSES: StoryboardShotStatus[] = ['empty', 'generating', 'ready', 'failed']

export const STORYBOARD_STATUS_LABEL: Record<StoryboardShotStatus, string> = {
  empty: '空',
  generating: '生成中',
  ready: '已有图',
  failed: '失败',
}

export function createStoryboardShot(index: number, prompt = ''): StoryboardShot {
  return {
    id: `shot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    index,
    prompt,
    characterIds: [],
    sceneId: null,
    status: 'empty',
  }
}

export function persistableStoryboard(shots: StoryboardShot[]): StoryboardShot[] {
  return shots.map((shot, index) => ({
    ...shot,
    index: index + 1,
    status: shot.status === 'generating' ? (shot.imageUrl ? 'ready' : 'empty') : shot.status,
  }))
}

export function normalizeStoryboard(value: unknown): StoryboardShot[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 80).map((item, index) => {
    const raw = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    const imageUrl = typeof raw.imageUrl === 'string' && raw.imageUrl ? raw.imageUrl : undefined
    const rawStatus = String(raw.status || '')
    const status: StoryboardShotStatus = STATUSES.includes(rawStatus as StoryboardShotStatus)
      ? rawStatus === 'generating'
        ? imageUrl
          ? 'ready'
          : 'empty'
        : (rawStatus as StoryboardShotStatus)
      : imageUrl
        ? 'ready'
        : 'empty'
    const characterIds = Array.isArray(raw.characterIds)
      ? raw.characterIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
      : []
    const sceneId = raw.sceneId == null || raw.sceneId === '' ? null : Number(raw.sceneId)
    return {
      id: String(raw.id || `shot_${index + 1}`),
      index: index + 1,
      prompt: String(raw.prompt || ''),
      characterIds,
      sceneId: Number.isFinite(sceneId) && sceneId ? sceneId : null,
      imageUrl,
      status,
      error: typeof raw.error === 'string' && raw.error ? raw.error : undefined,
    }
  })
}

const SCENE_HEADING = /^(?:第?[0-9一二三四五六七八九十百]+[场集镜]|镜号?\s*[0-9]+|INT\.|EXT\.|场次)/i

export function splitEpisodeScript(text: string): string[] {
  const source = text.replace(/\r\n/g, '\n').trim()
  if (!source) return []

  const blocks = source
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean)
  if (blocks.length > 1) return blocks.slice(0, 40)

  const lines = source.split('\n').map((item) => item.trim()).filter(Boolean)
  const headed: string[] = []
  let current: string[] = []
  for (const line of lines) {
    if (SCENE_HEADING.test(line) && current.length) {
      headed.push(current.join('\n'))
      current = [line]
      continue
    }
    current.push(line)
  }
  if (current.length) headed.push(current.join('\n'))
  if (headed.length > 1) return headed.slice(0, 40)

  return [source]
}

export function matchAssetIds(prompt: string, items: { id: number; name: string }[]): number[] {
  return items
    .filter((item) => item.name && prompt.includes(item.name))
    .map((item) => item.id)
}

export function shotsFromEpisodeScript(
  text: string,
  catalog: { characters: { id: number; name: string }[]; scenes: { id: number; name: string }[] }
): StoryboardShot[] {
  return splitEpisodeScript(text).map((prompt, index) => {
    const characterIds = matchAssetIds(prompt, catalog.characters)
    const sceneIds = matchAssetIds(prompt, catalog.scenes)
    return {
      ...createStoryboardShot(index + 1, prompt),
      characterIds,
      sceneId: sceneIds[0] ?? null,
    }
  })
}

type StoryboardCatalog = {
  characters: Character[]
  scenes: Scene[]
  objects?: ObjectItem[]
}

function shotAssets(shot: StoryboardShot, catalog: StoryboardCatalog) {
  const characters = shot.characterIds
    .map((id) => catalog.characters.find((item) => item.id === id))
    .filter((item): item is Character => Boolean(item))
  const scene = shot.sceneId ? catalog.scenes.find((item) => item.id === shot.sceneId) : undefined
  const objects = (catalog.objects || []).filter((item) => item.name && shot.prompt.includes(item.name))
  return { characters, scene, objects }
}

export function collectShotReferenceImages(shot: StoryboardShot, catalog: StoryboardCatalog): string[] {
  const { characters, scene, objects } = shotAssets(shot, catalog)
  const images: string[] = []
  for (const asset of [...characters, ...(scene ? [scene] : []), ...objects]) {
    const image = generationCover(asset)
    if (image && !images.includes(image)) images.push(image)
  }
  return images
}

export function buildShotPrompt(shot: StoryboardShot, catalog: StoryboardCatalog): string {
  const { characters, scene, objects } = shotAssets(shot, catalog)
  const names = characters.map((item) => item.name).filter(Boolean)
  const constraints = [...characters, ...(scene ? [scene] : []), ...objects]
    .map((item) => lockedPromptLine(item))
    .filter((line): line is string => Boolean(line))
  const extras = [
    names.length ? `角色：${names.join('、')}` : '',
    scene?.name ? `场景：${scene.name}` : '',
    constraints.length ? `定型约束：\n${constraints.join('\n')}` : '',
  ].filter(Boolean)
  return [shot.prompt.trim(), ...extras].filter(Boolean).join('\n')
}

export function pickStoryboardModel(hasRefs: boolean, availableIds: string[]): string {
  if (hasRefs && (availableIds.includes('wan2.6-image') || availableIds.length === 0)) {
    return 'wan2.6-image'
  }
  const preferred = ['wan2.6-t2i', 'wan2.7-image', 'qwen-image-2.0']
  return preferred.find((id) => availableIds.includes(id)) || availableIds[0] || 'wan2.6-t2i'
}

export function storyboardUsesReferenceImages(model: string): boolean {
  return isI2IModel(model)
}
