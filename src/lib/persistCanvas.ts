import { HttpError } from '@/api/core/error'
import { uploadCanvasMediaUrl } from '@/lib/uploadCanvasMedia'
import { workflowsApi } from '@/features/project/api/workflows'
import { useCanvasStore } from '@/features/infinite-canvas/stores/canvasStore'
import { useCanvasDocumentsStore } from '@/features/infinite-canvas/stores/projectsStore'
import {
  applyInlineReplacements,
  canvasSignature,
  collectInlineReplacements,
  graphHasInlineMedia,
  type CanvasGraph,
} from '@/lib/canvasPayload'
import type { CustomEdge, CustomNode } from '@/features/infinite-canvas/types'
import { graphWithoutGenerationTransients } from '@/features/infinite-canvas/utils/videoJobBinding'

export const CANVAS_AUTOSAVE_DEBOUNCE_MS = 800

export interface PersistCanvasOptions {
  projectId?: string | number
  workflowId?: string
  /** Skip the debounce. Used on leave / workflow switch so the snapshot is taken now. */
  immediate?: boolean
}

let timer: ReturnType<typeof setTimeout> | null = null
let flushing = false
let rerun = false
let pending: PersistCanvasOptions = {}
let savedKey = ''
let blockedKey = ''
const debounceResolvers: Array<() => void> = []
const waiters: Array<() => void> = []

export function resetCanvasAutosaveForTests() {
  if (timer) clearTimeout(timer)
  timer = null
  flushing = false
  rerun = false
  pending = {}
  savedKey = ''
  blockedKey = ''
  debounceResolvers.splice(0).forEach((resolve) => resolve())
  waiters.splice(0).forEach((resolve) => resolve())
}

function isTooLargeMessage(message: string): boolean {
  return /过大|entity too large|status code 413/i.test(message)
}

function isTooLarge(error: unknown): boolean {
  if (error instanceof HttpError && error.status === 413) return true
  return error instanceof Error && isTooLargeMessage(error.message)
}

function graphFromState(): CanvasGraph {
  const canvas = useCanvasStore.getState()
  return { nodes: canvas.nodes, edges: canvas.edges, viewport: canvas.viewport }
}

function autosaveKey(workflowId: string, graph: CanvasGraph): string {
  return `${workflowId}:${canvasSignature(graph)}`
}

async function saveOnce(): Promise<void> {
  const options = pending
  const canvas = useCanvasStore.getState()
  const workflowId = options.workflowId || canvas.currentProjectId
  if (!workflowId) return
  // A newer route can already be on screen. Never write that graph under the previous id,
  // and never write the previous graph under the id we have not loaded yet.
  if (options.workflowId && canvas.currentProjectId && options.workflowId !== canvas.currentProjectId) return
  const numericProjectId = Number(options.projectId ?? useCanvasDocumentsStore.getState().getProjectById(workflowId)?.projectId)
  if (!numericProjectId) return

  // Snapshot before the first await so switching workflows cannot write the next canvas onto this id.
  let graph: CanvasGraph = {
    nodes: canvas.nodes,
    edges: canvas.edges,
    viewport: canvas.viewport,
  }
  const seenKey = autosaveKey(workflowId, graphWithoutGenerationTransients(graph))
  if (seenKey === savedKey || seenKey === blockedKey) return

  let guard = 0
  while (graphHasInlineMedia(graph) && guard < 8) {
    guard += 1
    let replacements: Map<string, string>
    try {
      replacements = await collectInlineReplacements(graph, uploadCanvasMediaUrl)
    } catch (error) {
      if (isTooLarge(error)) blockedKey = autosaveKey(workflowId, graphWithoutGenerationTransients(graph))
      return
    }
    const stillThisWorkflow = useCanvasStore.getState().currentProjectId === workflowId
    if (stillThisWorkflow) {
      useCanvasStore.setState((state) => ({
        nodes: applyInlineReplacements(state.nodes, replacements),
        history: state.history.map((entry) => ({
          ...entry,
          nodes: applyInlineReplacements(entry.nodes, replacements),
        })),
      }))
      graph = graphFromState()
    } else {
      graph = applyInlineReplacements(graph, replacements)
    }
  }

  if (graphHasInlineMedia(graph)) return

  const persisted = graphWithoutGenerationTransients(graph)
  const key = autosaveKey(workflowId, persisted)
  if (key === savedKey || key === blockedKey) return

  useCanvasDocumentsStore.getState().updateProjectCanvas(workflowId, {
    nodes: persisted.nodes as CustomNode[],
    edges: persisted.edges as CustomEdge[],
    viewport: persisted.viewport,
  })
  const response = await workflowsApi.update(numericProjectId, workflowId, {
    canvasData: {
      nodes: persisted.nodes as CustomNode[],
      edges: persisted.edges as CustomEdge[],
      viewport: persisted.viewport,
    },
  })
  if (!response.success) {
    if (isTooLargeMessage(response.message || '')) blockedKey = key
    return
  }
  savedKey = key
  if (blockedKey.startsWith(`${workflowId}:`)) blockedKey = ''

  const latest = useCanvasStore.getState()
  if ((pending.workflowId || latest.currentProjectId) === workflowId) {
    const latestKey = autosaveKey(workflowId, graphWithoutGenerationTransients(graphFromState()))
    if (latestKey !== savedKey) rerun = true
  }
}

function flush(): Promise<void> {
  if (flushing) {
    rerun = true
    return new Promise((resolve) => {
      waiters.push(resolve)
    })
  }
  flushing = true
  const run = (async () => {
    try {
      do {
        rerun = false
        await saveOnce()
      } while (rerun)
    } finally {
      flushing = false
      const pendingWaiters = waiters.splice(0)
      pendingWaiters.forEach((resolve) => resolve())
    }
  })()
  return run
}

export function persistOpenCanvas(options?: PersistCanvasOptions): Promise<void> {
  pending = options ?? {}
  if (options?.immediate) {
    if (timer) clearTimeout(timer)
    timer = null
    const resolvers = debounceResolvers.splice(0)
    const job = flush()
    void job.finally(() => resolvers.forEach((resolve) => resolve()))
    return job
  }
  return new Promise((resolve) => {
    debounceResolvers.push(resolve)
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      const resolvers = debounceResolvers.splice(0)
      void flush().finally(() => resolvers.forEach((done) => done()))
    }, CANVAS_AUTOSAVE_DEBOUNCE_MS)
  })
}
