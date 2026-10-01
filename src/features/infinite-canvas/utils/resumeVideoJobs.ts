import { isCanceledError } from '@/api/core'
import { videoService } from '@/api/aigc/videoService'
import type { TaskProgress } from '@/api/aigc/types'
import { persistOpenCanvas } from '@/lib/persistCanvas'
import { useCanvasStore } from '../stores/canvasStore'
import type { NodeData } from '../types'
import { normalizeVideoQuantity } from './generateParams'
import {
  cancelGenerationJob,
  finishGenerationJob,
  hasGenerationJob,
  startGenerationJob,
} from './generationJobs'
import {
  appendVideoJobId,
  readVideoJobIds,
  videoResumeOutcome,
  type VideoJobSnapshot,
} from './videoJobBinding'

function sameJobIds(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false
  return left.every((id, index) => id === right[index])
}

function postersFromNode(data: NodeData): string[] | undefined {
  if (Array.isArray(data.thumbnailUrls)) {
    const listed = data.thumbnailUrls
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
    if (listed.length > 0) return listed
  }
  const single = typeof data.thumbnail === 'string' ? data.thumbnail.trim() : ''
  return single ? [single] : undefined
}

/** Remember a submitted video job on the node so a reload can poll it again. */
export function rememberNodeVideoJob(nodeId: string, jobId: string, workflowId?: string | null) {
  const clean = jobId.trim()
  if (!nodeId || !clean) return
  const store = useCanvasStore.getState()
  if (workflowId && store.currentProjectId && store.currentProjectId !== workflowId) return
  const node = store.nodes.find((item) => item.id === nodeId)
  if (!node) return
  const current = readVideoJobIds(node.data)
  const next = appendVideoJobId(current, clean)
  if (next.length === current.length) return
  store.updateNode(nodeId, { videoJobIds: next })
  void persistOpenCanvas()
}

function isGiveUp(error: unknown): boolean {
  return error instanceof Error && /视频生成超时|timeout/i.test(error.message)
}

async function watchOne(
  jobId: string,
  signal: AbortSignal,
  onProgress: (progress: TaskProgress) => void,
): Promise<VideoJobSnapshot | 'aborted' | 'retry' | 'dropped'> {
  try {
    const job = await videoService.watch(jobId, { signal, onProgress })
    return {
      jobId,
      status: job.status,
      progress: job.progress,
      message: job.message,
      url: job.url,
    }
  } catch (error) {
    if (signal.aborted) return 'aborted'
    // The request was canceled without a user cancel (refresh). Keep the job id.
    if (isCanceledError(error)) return 'dropped'
    if (isGiveUp(error)) return 'retry'
    return {
      jobId,
      status: 'failed',
      message: error instanceof Error ? error.message : '视频生成失败',
    }
  }
}

async function runResume(nodeId: string, jobIds: string[], signal: AbortSignal, workflowId: string) {
  const phases = jobIds.map(() => '排队中')
  const percents: Array<number | undefined> = jobIds.map(() => undefined)

  const stillThisNode = () => {
    const store = useCanvasStore.getState()
    if (store.currentProjectId !== workflowId) return false
    const node = store.nodes.find((item) => item.id === nodeId)
    if (!node) return false
    return sameJobIds(readVideoJobIds(node.data), jobIds)
  }

  const publish = () => {
    if (signal.aborted || !stillThisNode()) return
    const known = percents.filter((item): item is number => typeof item === 'number')
    const progress = known.length
      ? Math.round(known.reduce((sum, item) => sum + item, 0) / jobIds.length)
      : undefined
    const phase = phases.find((item) => item && item !== '排队中') || '排队中'
    useCanvasStore.getState().updateNode(nodeId, {
      loading: true,
      statusLabel: phase,
      ...(typeof progress === 'number' ? { progress } : {}),
    })
  }

  try {
    const results = await Promise.all(jobIds.map((jobId, index) => watchOne(jobId, signal, (progress) => {
      if (progress.status === 'PENDING') phases[index] = '排队中'
      else if (progress.status === 'RUNNING') phases[index] = '生成中'
      else return
      if (typeof progress.percent === 'number' && Number.isFinite(progress.percent)) {
        percents[index] = progress.percent
      }
      publish()
    })))

    if (signal.aborted || results.some((item) => item === 'aborted') || !stillThisNode()) return

    if (results.some((item) => item === 'dropped')) {
      useCanvasStore.getState().updateNode(nodeId, {
        loading: false,
        progress: undefined,
        statusLabel: undefined,
      })
      void persistOpenCanvas()
      return
    }

    if (results.some((item) => item === 'retry')) {
      useCanvasStore.getState().updateNode(nodeId, {
        loading: false,
        error: '视频生成超时，请稍后重试',
        progress: undefined,
        statusLabel: undefined,
      })
      void persistOpenCanvas()
      return
    }

    const jobs = results.filter((item): item is VideoJobSnapshot => typeof item === 'object')
    const node = useCanvasStore.getState().nodes.find((item) => item.id === nodeId)
    const requested = Math.max(normalizeVideoQuantity(node?.data.n), jobIds.length)
    const outcome = videoResumeOutcome({
      jobs,
      nodeId,
      requestedCount: requested,
      posters: node ? postersFromNode(node.data) : undefined,
    })
    if (!outcome.done || !stillThisNode()) return
    useCanvasStore.getState().updateNode(nodeId, outcome.patch)
    void persistOpenCanvas()
  } finally {
    finishGenerationJob(nodeId, signal)
  }
}

/** Start polling any video jobs that were saved on the open canvas. */
export function beginCanvasVideoJobResume() {
  const store = useCanvasStore.getState()
  const workflowId = store.currentProjectId
  if (!workflowId) return

  for (const node of store.nodes) {
    const jobIds = readVideoJobIds(node.data)
    if (jobIds.length === 0 || hasGenerationJob(node.id)) continue
    const signal = startGenerationJob(node.id)
    store.updateNode(node.id, {
      loading: true,
      error: '',
      statusLabel: '排队中',
      progress: undefined,
    })
    void runResume(node.id, jobIds, signal, workflowId)
  }
}

/**
 * Cancel control for a media node.
 * Uses the in-memory poller when this tab started it, and the persisted video job id after a reload.
 */
export function bindNodeVideoResumeCancel(
  nodeId: string,
  updateNode: (id: string, data: Partial<NodeData>) => void,
): (() => void) | undefined {
  const node = useCanvasStore.getState().nodes.find((item) => item.id === nodeId)
  const persisted = readVideoJobIds(node?.data)
  if (!hasGenerationJob(nodeId) && persisted.length === 0) return undefined
  return () => {
    const latest = useCanvasStore.getState().nodes.find((item) => item.id === nodeId)
    for (const jobId of readVideoJobIds(latest?.data)) {
      videoService.cancel(jobId)
    }
    cancelGenerationJob(nodeId)
    updateNode(nodeId, {
      loading: false,
      error: '',
      progress: undefined,
      statusLabel: undefined,
      videoJobIds: undefined,
    })
    void persistOpenCanvas()
  }
}
