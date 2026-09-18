import { create } from 'zustand'
import { imageService, isI2IModel } from '@/api/aigc'
import { aspectToSize } from '@/lib/generateAssetImage'
import { useProjectStore } from '@/store/projectStore'

export type AssetKind = 'scene' | 'character' | 'object' | 'episode'

export type AssetGenTask = {
  id: string
  kind: AssetKind
  projectId: number
  assetId?: number
  name: string
  prompt: string
  model: string
  status: 'running' | 'succeeded' | 'failed'
  progress: string
  imageUrl?: string
  error?: string
  createdAt: number
}

export const assetTaskKey = (kind: AssetKind, projectId: number, assetId?: number) =>
  assetId ? `${kind}:${projectId}:${assetId}` : `${kind}:${projectId}:create`

export function tasksForAsset(
  tasks: AssetGenTask[],
  kind: AssetKind,
  projectId?: number | null,
  assetId?: number
) {
  return tasks.filter((task) => {
    if (task.kind !== kind) return false
    if (projectId != null && !Number.isNaN(Number(projectId)) && Number(task.projectId) !== Number(projectId)) {
      return false
    }
    if (assetId) return Number(task.assetId) === Number(assetId)
    return !task.assetId
  })
}

const STORAGE_KEY = 'mangacanvas-asset-gen-tasks'
const LEGACY_KEY = 'mangacanvas-scene-gen-tasks'

const STATUS_LABEL: Record<string, string> = {
  PENDING: '任务排队中...',
  RUNNING: '图片生成中...',
  SUCCEEDED: '生成完成',
  FAILED: '生成失败',
  UNKNOWN: '处理中...',
}

export type StartAssetGenerationInput = {
  kind: AssetKind
  projectId: number
  assetId?: number
  name: string
  prompt: string
  model: string
  aspectRatio?: keyof typeof aspectToSize
  size?: string
  referenceImages?: string[]
  extras?: {
    description?: string
    distance?: number
    zoom?: number
    gender?: string
    ageGroup?: string
    style?: string
    episodeCount?: string
  }
}

interface AssetGenerationState {
  tasks: AssetGenTask[]
  runningKeys: Record<string, boolean>
  start: (input: StartAssetGenerationInput) => Promise<'ok' | 'busy'>
}

function normalizeTask(task: Partial<AssetGenTask> & { sceneId?: number }): AssetGenTask | null {
  if (!task.id || !task.projectId) return null
  const status = task.status === 'running' ? 'failed' : task.status || 'failed'
  return {
    id: String(task.id),
    kind: task.kind || 'scene',
    projectId: Number(task.projectId),
    assetId: task.assetId ?? task.sceneId,
    name: task.name || '',
    prompt: task.prompt || '',
    model: task.model || '',
    status: status === 'succeeded' || status === 'failed' ? status : 'failed',
    progress: task.status === 'running' ? '已中断，请重新提交' : task.progress || '',
    imageUrl: task.imageUrl,
    error: task.status === 'running' ? '离开或刷新后任务中断' : task.error,
    createdAt: task.createdAt || 0,
  }
}

function readStoredTasks(): AssetGenTask[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(LEGACY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => normalizeTask(item as Partial<AssetGenTask>)).filter(Boolean) as AssetGenTask[]
  } catch {
    return []
  }
}

function writeStoredTasks(tasks: AssetGenTask[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tasks.slice(0, 40)))
  } catch {
    // ignore quota / private mode
  }
}

function patchTask(tasks: AssetGenTask[], id: string, patch: Partial<AssetGenTask>) {
  const next = tasks.map((item) => (item.id === id ? { ...item, ...patch } : item))
  writeStoredTasks(next)
  return next
}

async function persistGenerated(input: StartAssetGenerationInput, imageUrl: string) {
  const store = useProjectStore.getState()
  const extras = input.extras || {}
  if (input.kind === 'scene') {
    if (input.assetId) {
      await store.updateScene(input.projectId, input.assetId, {
        name: input.name,
        description: extras.description ?? input.prompt,
        image: imageUrl,
        status: 'in-use',
      })
      return
    }
    await store.createScene(input.projectId, {
      name: input.name,
      genMethod: 'model',
      model: input.model,
      description: extras.description ?? input.prompt,
      distance: extras.distance ?? 8,
      zoom: extras.zoom ?? 0.6,
      status: 'in-use',
      referenceImage: imageUrl,
    })
    return
  }
  if (input.kind === 'character') {
    if (input.assetId) {
      await store.updateCharacter(input.projectId, input.assetId, {
        name: input.name,
        description: input.prompt,
        image: imageUrl,
        model: input.model,
        gender: extras.gender,
        ageGroup: extras.ageGroup,
        style: extras.style,
        hasImage: true,
      })
      return
    }
    await store.createCharacter(input.projectId, {
      name: input.name,
      gender: extras.gender || 'other',
      ageGroup: extras.ageGroup || 'young',
      genMethod: 'model',
      model: input.model,
      style: extras.style,
      description: input.prompt,
      referenceImage: imageUrl,
    })
    return
  }
  if (input.kind === 'object') {
    if (input.assetId) {
      await store.updateObject(input.projectId, input.assetId, {
        name: input.name,
        description: input.prompt,
        image: imageUrl,
      })
      return
    }
    await store.createObject(input.projectId, {
      name: input.name,
      genMethod: 'model',
      model: input.model,
      prompt: input.prompt,
      referenceImage: imageUrl,
    })
  }
}

export function withExistingAssetResult(
  tasks: AssetGenTask[],
  existing?: {
    kind: AssetKind
    projectId: number
    assetId?: number
    name: string
    prompt?: string
    model?: string
    imageUrl?: string
  }
): AssetGenTask[] {
  if (!existing?.imageUrl) return tasks
  const already = tasks.some(
    (task) =>
      (existing.assetId && task.assetId === existing.assetId && task.kind === existing.kind && task.imageUrl) ||
      task.imageUrl === existing.imageUrl
  )
  if (already) return tasks
  return [
    {
      id: `existing-${existing.kind}-${existing.assetId || 'new'}`,
      kind: existing.kind,
      projectId: existing.projectId,
      assetId: existing.assetId,
      name: existing.name,
      prompt: existing.prompt || '',
      model: existing.model || '',
      status: 'succeeded',
      progress: '已完成',
      imageUrl: existing.imageUrl,
      createdAt: 0,
    },
    ...tasks,
  ]
}

export const useAssetGenerationStore = create<AssetGenerationState>((set, get) => ({
  tasks: readStoredTasks(),
  runningKeys: {},

  start: async (input) => {
    const projectId = Number(input.projectId)
    const key = assetTaskKey(input.kind, projectId, input.assetId)
    if (get().runningKeys[key]) return 'busy'

    const id = `${input.kind}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const task: AssetGenTask = {
      id,
      kind: input.kind,
      projectId,
      assetId: input.assetId,
      name: input.name,
      prompt: input.prompt,
      model: input.model,
      status: 'running',
      progress: '准备中...',
      createdAt: Date.now(),
    }

    set((state) => {
      const tasks = [task, ...state.tasks]
      writeStoredTasks(tasks)
      return {
        tasks,
        runningKeys: { ...state.runningKeys, [key]: true },
      }
    })

    await Promise.resolve()

    try {
      const size = input.size || aspectToSize[input.aspectRatio || (input.kind === 'scene' || input.kind === 'episode' ? '16:9' : '1:1')]
      const urls = await imageService.generate({
        model: input.model,
        prompt: input.prompt,
        size,
        quality: 'medium',
        n: 1,
        images: isI2IModel(input.model) ? input.referenceImages : undefined,
        onProgress: (progress) => {
          const label = STATUS_LABEL[progress.status] ?? progress.status
          set((state) => ({ tasks: patchTask(state.tasks, id, { progress: label }) }))
        },
      })
      const imageUrl = urls?.[0]
      if (!imageUrl) throw new Error('未返回生成结果')

      set((state) => ({
        tasks: patchTask(state.tasks, id, { status: 'succeeded', progress: '生成完成', imageUrl }),
      }))
      await persistGenerated({ ...input, projectId }, imageUrl)
      return 'ok'
    } catch (error) {
      const messageText = error instanceof Error ? error.message : '生成失败'
      set((state) => ({
        tasks: patchTask(state.tasks, id, { status: 'failed', progress: '生成失败', error: messageText }),
      }))
      throw error
    } finally {
      set((state) => {
        const runningKeys = { ...state.runningKeys }
        delete runningKeys[key]
        return { runningKeys }
      })
    }
  },
}))
