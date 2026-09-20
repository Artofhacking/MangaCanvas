import type { NodeData } from '../types'

const jobs = new Map<string, AbortController>()

export function startGenerationJob(nodeId: string): AbortSignal {
  const existing = jobs.get(nodeId)
  if (existing) {
    existing.abort()
  }
  const controller = new AbortController()
  jobs.set(nodeId, controller)
  return controller.signal
}

export function cancelGenerationJob(nodeId: string): boolean {
  const controller = jobs.get(nodeId)
  if (!controller) return false
  controller.abort()
  jobs.delete(nodeId)
  return true
}

export function finishGenerationJob(nodeId: string, signal: AbortSignal): boolean {
  const controller = jobs.get(nodeId)
  if (!controller || controller.signal !== signal) return false
  jobs.delete(nodeId)
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
    updateNode(nodeId, { loading: false, error: '', progress: undefined })
  }
}
