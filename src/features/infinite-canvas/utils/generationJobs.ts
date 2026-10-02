import { DETACH_ABORT_REASON, USER_CANCEL_ABORT_REASON } from '@/lib/generationAbort'
import type { NodeData } from '../types'

const jobs = new Map<string, AbortController>()
const listeners = new Set<() => void>()

function emitGenerationJobs() {
  for (const listener of [...listeners]) listener()
}

export function subscribeGenerationJobs(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function startGenerationJob(nodeId: string): AbortSignal {
  const existing = jobs.get(nodeId)
  if (existing) {
    existing.abort(DETACH_ABORT_REASON)
  }
  const controller = new AbortController()
  jobs.set(nodeId, controller)
  emitGenerationJobs()
  return controller.signal
}

/**
 * Claim a node only when nothing is in flight.
 * A second Generate click must not abort the local poller: detach does not cancel
 * the upstream video job, so replacing the controller would stack another submit.
 */
export function tryStartGenerationJob(nodeId: string): AbortSignal | null {
  if (hasGenerationJob(nodeId)) return null
  return startGenerationJob(nodeId)
}

export function cancelGenerationJob(nodeId: string): boolean {
  const controller = jobs.get(nodeId)
  if (!controller) return false
  controller.abort(USER_CANCEL_ABORT_REASON)
  jobs.delete(nodeId)
  emitGenerationJobs()
  return true
}

/** Stop in-memory pollers when the canvas closes. Does not cancel backend video jobs. */
export function stopLocalGenerationJobs() {
  if (jobs.size === 0) return
  for (const controller of jobs.values()) {
    if (!controller.signal.aborted) controller.abort(DETACH_ABORT_REASON)
  }
  jobs.clear()
  emitGenerationJobs()
}

export function finishGenerationJob(nodeId: string, signal: AbortSignal): boolean {
  const controller = jobs.get(nodeId)
  if (!controller || controller.signal !== signal) return false
  jobs.delete(nodeId)
  emitGenerationJobs()
  return true
}

export function hasGenerationJob(nodeId: string): boolean {
  const controller = jobs.get(nodeId)
  return Boolean(controller && !controller.signal.aborted)
}

export function readNodeProgress(data?: Pick<NodeData, 'progress'> | null): number | undefined {
  const value = data?.progress
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.max(0, Math.min(100, value))
}

export function formatGeneratingLabel(progress?: number) {
  if (typeof progress === 'number' && Number.isFinite(progress)) {
    return `生成中 ${Math.round(Math.max(0, Math.min(100, progress)))}%…`
  }
  return '生成中…'
}

export function bindNodeGenerationCancel(
  nodeId: string,
  updateNode: (id: string, data: Partial<NodeData>) => void
): (() => void) | undefined {
  if (!hasGenerationJob(nodeId)) return undefined
  return () => {
    if (!cancelGenerationJob(nodeId)) return
    updateNode(nodeId, { loading: false, error: '', progress: undefined, statusLabel: undefined })
  }
}
