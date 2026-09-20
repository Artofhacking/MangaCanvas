import { create } from 'zustand'
import type { AssetGenTask } from '@/store/assetGenerationStore'

export type GenerationMediaType = 'image' | 'video'
export type GenerationStatus = 'running' | 'succeeded' | 'failed'

export type GenerationHistoryItem = {
  id: string
  mediaType: GenerationMediaType
  status: GenerationStatus
  title: string
  prompt: string
  thumbnailUrl?: string
  resultUrl?: string
  error?: string
  source?: string
  createdAt: number
}

const STORAGE_KEY = 'mangacanvas-generation-history'
const MAX_ITEMS = 80

export const MEDIA_TYPE_LABEL: Record<GenerationMediaType, string> = {
  image: '图片',
  video: '视频',
}

export const STATUS_LABEL: Record<GenerationStatus, string> = {
  succeeded: '成功',
  failed: '失败',
  running: '进行中',
}

export const ASSET_KIND_LABEL: Record<string, string> = {
  scene: '场景',
  character: '角色',
  object: '物品',
  episode: '片段',
}

export function titleFromPrompt(prompt: string, fallback: string) {
  const text = prompt.trim().replace(/\s+/g, ' ')
  if (!text) return fallback
  return text.length > 24 ? `${text.slice(0, 24)}…` : text
}

export function formatRelativeTime(timestamp: number) {
  if (!timestamp) return ''
  const delta = Date.now() - timestamp
  if (delta < 60_000) return '刚刚'
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} 分钟前`
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} 小时前`
  if (delta < 172_800_000) return '昨天'
  return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

function normalizeItem(item: Partial<GenerationHistoryItem>): GenerationHistoryItem | null {
  if (!item.id) return null
  const status = item.status === 'running' ? 'failed' : item.status === 'succeeded' ? 'succeeded' : 'failed'
  return {
    id: String(item.id),
    mediaType: item.mediaType === 'video' ? 'video' : 'image',
    status,
    title: item.title || titleFromPrompt(item.prompt || '', status === 'failed' ? '生成任务' : '生成结果'),
    prompt: item.prompt || '',
    thumbnailUrl: item.thumbnailUrl || item.resultUrl,
    resultUrl: item.resultUrl || item.thumbnailUrl,
    error: item.status === 'running' ? '离开或刷新后任务中断' : item.error,
    source: item.source,
    createdAt: item.createdAt || 0,
  }
}

function readStored(): GenerationHistoryItem[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => normalizeItem(item as Partial<GenerationHistoryItem>)).filter(Boolean) as GenerationHistoryItem[]
  } catch {
    return []
  }
}

function writeStored(items: GenerationHistoryItem[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
  } catch {
    // ignore quota / private mode
  }
}

function commit(items: GenerationHistoryItem[]) {
  const next = items.slice(0, MAX_ITEMS)
  writeStored(next)
  return next
}

export function mapAssetTaskToHistory(task: AssetGenTask): GenerationHistoryItem {
  const kindLabel = ASSET_KIND_LABEL[task.kind] || '图片'
  return {
    id: `asset:${task.id}`,
    mediaType: 'image',
    status: task.status,
    title: task.name || titleFromPrompt(task.prompt, kindLabel),
    prompt: task.prompt,
    thumbnailUrl: task.imageUrl,
    resultUrl: task.imageUrl,
    error: task.error,
    source: task.kind,
    createdAt: task.createdAt,
  }
}

export function mergeGenerationHistory(
  history: GenerationHistoryItem[],
  assetTasks: AssetGenTask[]
): GenerationHistoryItem[] {
  const seenIds = new Set(history.map((item) => item.id))
  const seenResults = new Set(history.map((item) => item.resultUrl).filter(Boolean) as string[])
  const extras = assetTasks
    .map(mapAssetTaskToHistory)
    .filter((item) => {
      if (seenIds.has(item.id)) return false
      if (item.resultUrl && seenResults.has(item.resultUrl)) return false
      const nearDuplicate = history.some(
        (existing) =>
          existing.prompt === item.prompt &&
          existing.mediaType === item.mediaType &&
          Math.abs((existing.createdAt || 0) - (item.createdAt || 0)) < 4000
      )
      return !nearDuplicate
    })
  return [...history, ...extras].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

interface GenerationHistoryState {
  items: GenerationHistoryItem[]
  start: (input: { mediaType: GenerationMediaType; prompt: string; title?: string; source?: string }) => string
  succeed: (id: string, url: string) => void
  fail: (id: string, error: string) => void
}

export const useGenerationHistoryStore = create<GenerationHistoryState>((set, get) => ({
  items: readStored(),

  start: (input) => {
    const id = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const item: GenerationHistoryItem = {
      id,
      mediaType: input.mediaType,
      status: 'running',
      title: input.title || titleFromPrompt(input.prompt, input.mediaType === 'video' ? '视频生成' : '图像生成'),
      prompt: input.prompt,
      source: input.source,
      createdAt: Date.now(),
    }
    set({ items: commit([item, ...get().items]) })
    return id
  },

  succeed: (id, url) => {
    set({
      items: commit(
        get().items.map((item) =>
          item.id === id
            ? { ...item, status: 'succeeded', thumbnailUrl: url, resultUrl: url, error: undefined }
            : item
        )
      ),
    })
  },

  fail: (id, error) => {
    set({
      items: commit(
        get().items.map((item) => (item.id === id ? { ...item, status: 'failed', error } : item))
      ),
    })
  },
}))
