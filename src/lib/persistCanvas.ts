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
import { isDraftWorkflowId } from '@/lib/workflows'

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
/** Server ids whose canvas was loaded or saved in this session. Empty saves may delete these. */
const confirmedIds = new Set<string>()
/** Ids we already removed, or that 404'd, so the next non-empty save creates a row. */
const droppedIds = new Set<string>()
/** Draft or deleted id -> the server id that now owns this editing session. */
const idAlias = new Map<string, string>()
let adoptedWorkflowId = ''
let onWorkflowAdopted: ((workflowId: string) => void) | null = null

const SOURCE_TYPES = ['blank', 'episode', 'scene', 'character', 'object'] as const
type WorkflowSourceType = (typeof SOURCE_TYPES)[number]

export function resetCanvasAutosaveForTests() {
  if (timer) clearTimeout(timer)
  timer = null
  flushing = false
  rerun = false
  pending = {}
  savedKey = ''
  blockedKey = ''
  confirmedIds.clear()
  droppedIds.clear()
  idAlias.clear()
  adoptedWorkflowId = ''
  onWorkflowAdopted = null
  debounceResolvers.splice(0).forEach((resolve) => resolve())
  waiters.splice(0).forEach((resolve) => resolve())
}

/** The open canvas was read from the server, so a later empty save may delete that row. */
export function noteWorkflowLoaded(workflowId: string) {
  if (!workflowId || isDraftWorkflowId(workflowId)) return
  confirmedIds.add(workflowId)
  droppedIds.delete(workflowId)
}

export function isAdoptedWorkflow(workflowId: string) {
  return adoptedWorkflowId !== '' && adoptedWorkflowId === workflowId
}

export function setPersistedWorkflowListener(listener: ((workflowId: string) => void) | null) {
  onWorkflowAdopted = listener
}

function resolveWorkflowId(workflowId: string): string {
  const seen = new Set<string>()
  let current = workflowId
  while (idAlias.has(current) && !seen.has(current)) {
    seen.add(current)
    current = idAlias.get(current) as string
  }
  return current
}

function rememberAlias(previousId: string, nextId: string) {
  for (const [key, value] of idAlias) {
    if (value === previousId) idAlias.set(key, nextId)
  }
  idAlias.set(previousId, nextId)
}

function isMissingWorkflow(message?: string) {
  return /不存在|not found|404/i.test(message || '')
}

function asSourceType(value: string | undefined): WorkflowSourceType {
  return SOURCE_TYPES.includes(value as WorkflowSourceType) ? (value as WorkflowSourceType) : 'blank'
}

function markRerunIfStale(workflowId: string) {
  const latest = useCanvasStore.getState()
  const liveId = latest.currentProjectId ? resolveWorkflowId(latest.currentProjectId) : ''
  if ((pending.workflowId ? resolveWorkflowId(pending.workflowId) : liveId) !== workflowId && liveId !== workflowId) {
    return
  }
  const latestKey = autosaveKey(workflowId, graphWithoutGenerationTransients(graphFromState()))
  if (latestKey !== savedKey) rerun = true
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

async function forgetEmptyWorkflow(projectId: number, workflowId: string, persisted: CanvasGraph) {
  const key = autosaveKey(workflowId, persisted)
  const canDelete = confirmedIds.has(workflowId) && !droppedIds.has(workflowId) && !isDraftWorkflowId(workflowId)
  if (canDelete) {
    const response = await workflowsApi.delete(projectId, workflowId)
    if (!response.success && !isMissingWorkflow(response.message)) return
    droppedIds.add(workflowId)
    confirmedIds.delete(workflowId)
  }
  savedKey = key
  markRerunIfStale(workflowId)
}

async function createWorkflowFromCanvas(projectId: number, workflowId: string, persisted: CanvasGraph) {
  const doc = useCanvasDocumentsStore.getState().getProjectById(workflowId)
  const response = await workflowsApi.create(projectId, {
    name: doc?.name || '空白工作流',
    sourceType: asSourceType(doc?.sourceType),
    sourceAssetId: doc?.sourceAssetId,
    canvasData: {
      nodes: persisted.nodes as CustomNode[],
      edges: persisted.edges as CustomEdge[],
      viewport: persisted.viewport,
    },
  })
  if (!response.success || !response.data?.id) return
  const created = response.data
  const nextId = created.id
  useCanvasDocumentsStore.getState().reassignWorkflowDocument(workflowId, {
    id: nextId,
    name: doc?.name || created.name || '空白工作流',
    projectId: doc?.projectId || String(projectId),
    sourceType: doc?.sourceType || created.sourceType || 'blank',
    sourceAssetId: doc?.sourceAssetId ?? created.sourceAssetId,
    canvasData: {
      nodes: persisted.nodes as CustomNode[],
      edges: persisted.edges as CustomEdge[],
      viewport: persisted.viewport,
    },
  })
  rememberAlias(workflowId, nextId)
  droppedIds.delete(workflowId)
  droppedIds.delete(nextId)
  confirmedIds.add(nextId)
  savedKey = autosaveKey(nextId, persisted)
  pending = { ...pending, workflowId: nextId, projectId }
  useCanvasStore.setState({ currentProjectId: nextId })
  adoptedWorkflowId = nextId
  onWorkflowAdopted?.(nextId)
  markRerunIfStale(nextId)
}

async function saveOnce(): Promise<void> {
  const options = pending
  const canvas = useCanvasStore.getState()
  const requestedId = options.workflowId || canvas.currentProjectId
  if (!requestedId) return
  const workflowId = resolveWorkflowId(requestedId)
  const liveId = canvas.currentProjectId ? resolveWorkflowId(canvas.currentProjectId) : ''
  // A newer route can already be on screen. Never write that graph under the previous id,
  // and never write the previous graph under the id we have not loaded yet.
  if (options.workflowId && liveId && workflowId !== liveId) return
  const numericProjectId = Number(options.projectId ?? useCanvasDocumentsStore.getState().getProjectById(workflowId)?.projectId)
  if (!numericProjectId) return

  // Snapshot before the first await so switching workflows cannot write the next canvas onto this id.
  let graph: CanvasGraph = {
    nodes: canvas.nodes,
    edges: canvas.edges,
    viewport: canvas.viewport,
  }
  const seenPersisted = graphWithoutGenerationTransients(graph)
  const seenKey = autosaveKey(workflowId, seenPersisted)
  if (seenKey === savedKey || seenKey === blockedKey) {
    // A loaded empty canvas can be confirmed after the first skip. Still drop that row.
    if (seenPersisted.nodes.length === 0 && confirmedIds.has(workflowId) && !droppedIds.has(workflowId)) {
      await forgetEmptyWorkflow(numericProjectId, workflowId, seenPersisted)
    }
    return
  }
  if (seenPersisted.nodes.length === 0) {
    await forgetEmptyWorkflow(numericProjectId, workflowId, seenPersisted)
    return
  }

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
    const liveNow = useCanvasStore.getState().currentProjectId
    const stillThisWorkflow = typeof liveNow === 'string' && resolveWorkflowId(liveNow) === workflowId
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

  const needsCreate = isDraftWorkflowId(workflowId) || droppedIds.has(workflowId)
  if (needsCreate) {
    await createWorkflowFromCanvas(numericProjectId, workflowId, persisted)
    return
  }

  const response = await workflowsApi.update(numericProjectId, workflowId, {
    canvasData: {
      nodes: persisted.nodes as CustomNode[],
      edges: persisted.edges as CustomEdge[],
      viewport: persisted.viewport,
    },
  })
  if (!response.success) {
    if (isMissingWorkflow(response.message)) {
      droppedIds.add(workflowId)
      confirmedIds.delete(workflowId)
      rerun = true
      return
    }
    if (isTooLargeMessage(response.message || '')) blockedKey = key
    return
  }
  if (!response.data) {
    droppedIds.add(workflowId)
    confirmedIds.delete(workflowId)
    savedKey = key
    markRerunIfStale(workflowId)
    return
  }
  confirmedIds.add(workflowId)
  savedKey = key
  if (blockedKey.startsWith(`${workflowId}:`)) blockedKey = ''
  markRerunIfStale(workflowId)
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
  if (options?.workflowId) {
    pending = { ...options, workflowId: resolveWorkflowId(options.workflowId) }
  } else {
    pending = options ?? {}
  }
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
