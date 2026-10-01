import type { NodeData } from '../types'
import { buildGeneratedVideoNodePatch } from './videoStack'

/** Fields that describe an in-flight UI only. They must not be stored with the canvas. */
export const TRANSIENT_GENERATION_FIELDS = ['loading', 'progress', 'statusLabel'] as const

export interface VideoJobSnapshot {
  jobId: string
  status: string
  progress?: number | null
  message?: string | null
  url?: string
}

export function readVideoJobIds(data?: { videoJobIds?: unknown } | null): string[] {
  if (!data || !Array.isArray(data.videoJobIds)) return []
  const seen = new Set<string>()
  const ids: string[] = []
  for (const item of data.videoJobIds) {
    if (typeof item !== 'string') continue
    const id = item.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

export function appendVideoJobId(existing: readonly string[], jobId: string): string[] {
  const ids = readVideoJobIds({ videoJobIds: [...existing] })
  const next = jobId.trim()
  if (!next || ids.includes(next)) return ids
  return [...ids, next]
}

export function isActiveVideoJobStatus(status: string): boolean {
  return status === 'queued' || status === 'running'
}

export function stripNodeGenerationTransients<T extends { data?: object | null }>(node: T): T {
  const data = node.data
  if (!data) return node
  const record = data as Record<string, unknown>
  if (!TRANSIENT_GENERATION_FIELDS.some((key) => key in record)) return node
  const next: Record<string, unknown> = { ...record }
  for (const key of TRANSIENT_GENERATION_FIELDS) delete next[key]
  return { ...node, data: next as T['data'] }
}

export function graphWithoutGenerationTransients<T extends { nodes: unknown[] }>(graph: T): T {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      if (!node || typeof node !== 'object') return node
      return stripNodeGenerationTransients(node as { data?: object | null })
    }),
  }
}

export interface VideoResumeOutcome {
  done: boolean
  patch: Partial<NodeData>
}

/**
 * What to write once every persisted video job has been read.
 * Active jobs keep the generating overlay. Terminal jobs clear it and drop the ids.
 */
export function videoResumeOutcome(input: {
  jobs: readonly VideoJobSnapshot[]
  nodeId: string
  requestedCount?: number
  posters?: readonly string[]
  now?: number
}): VideoResumeOutcome {
  const clearJobs = { videoJobIds: undefined }
  if (input.jobs.length === 0) {
    return {
      done: true,
      patch: { loading: false, progress: undefined, statusLabel: undefined, ...clearJobs },
    }
  }

  const urls: string[] = []
  const failures: string[] = []
  let cancelled = 0
  let active = 0
  for (const job of input.jobs) {
    if (isActiveVideoJobStatus(job.status)) {
      active += 1
      continue
    }
    if (job.status === 'succeeded') {
      const url = typeof job.url === 'string' ? job.url.trim() : ''
      if (url) urls.push(url)
      else failures.push(job.message?.trim() || '生成成功但未找到视频 URL')
      continue
    }
    if (job.status === 'cancelled') {
      cancelled += 1
      continue
    }
    failures.push(job.message?.trim() || '视频生成失败')
  }

  if (active > 0) {
    const known = input.jobs
      .map((job) => (typeof job.progress === 'number' && Number.isFinite(job.progress) ? job.progress : undefined))
      .filter((item): item is number => typeof item === 'number')
    const progress = known.length
      ? Math.round(known.reduce((sum, item) => sum + item, 0) / input.jobs.length)
      : undefined
    const running = input.jobs.some((job) => job.status === 'running')
    return {
      done: false,
      patch: {
        loading: true,
        error: '',
        statusLabel: running ? '生成中' : '排队中',
        progress,
      },
    }
  }

  if (urls.length > 0) {
    const requested = input.requestedCount && input.requestedCount > 0 ? input.requestedCount : input.jobs.length
    const outcome = buildGeneratedVideoNodePatch({
      urls,
      posters: input.posters,
      requestedCount: requested,
      nodeId: input.nodeId,
      now: input.now,
    })
    return { done: true, patch: { ...outcome.patch, ...clearJobs } }
  }

  if (cancelled === input.jobs.length && failures.length === 0) {
    return {
      done: true,
      patch: {
        loading: false,
        error: '',
        progress: undefined,
        statusLabel: undefined,
        ...clearJobs,
      },
    }
  }

  return {
    done: true,
    patch: {
      loading: false,
      error: failures[0] || '视频生成失败',
      progress: undefined,
      statusLabel: undefined,
      ...clearJobs,
    },
  }
}
