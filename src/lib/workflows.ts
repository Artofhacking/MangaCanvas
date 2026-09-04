import { workflowsApi } from '@/features/project/api/workflows'
import type { WorkflowSourceType } from '@/types'

const sourceLabelMap: Record<string, string> = {
  blank: '空白',
  episode: '片段',
  scene: '场景',
  character: '角色',
  object: '物品',
}

export const createWorkflowId = () =>
  `workflow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const createWorkflowPath = (projectId: string, workflowId: string) =>
  `/project/${projectId}/workflows/${workflowId}`

export const createWorkflowName = (sourceType: WorkflowSourceType, sourceName?: string) => {
  if (sourceName?.trim()) {
    return `${sourceName} 工作流`
  }
  return `${sourceLabelMap[sourceType] || '项目'}工作流`
}

export type WorkflowSeedAsset = {
  id: number
  name: string
  image?: string
  category: 'character' | 'scene' | 'object'
}

export type OpenWorkflowOptions = {
  projectId: string
  sourceType: WorkflowSourceType
  sourceName?: string
  sourceAssetId?: number
  seedImage?: string
  seedPrompt?: string
  relatedAssets?: WorkflowSeedAsset[]
  forceNew?: boolean
}

export type CanvasGraph = {
  nodes: Array<{
    id: string
    type: string
    position: { x: number; y: number }
    data: Record<string, unknown>
  }>
  edges: Array<{ id: string; source: string; target: string }>
  viewport: { x: number; y: number; zoom: number }
}

export const emptyCanvasData = (): CanvasGraph => ({
  nodes: [],
  edges: [],
  viewport: { x: 100, y: 50, zoom: 0.8 },
})

export const normalizeCanvasData = (canvasData?: {
  nodes?: unknown[]
  edges?: unknown[]
  viewport?: { x: number; y: number; zoom: number }
}): CanvasGraph => {
  const nodes = ((canvasData?.nodes || []) as CanvasGraph['nodes']).map((node) => {
    const data = { ...(node.data || {}) }
    if (node.type === 'text' && !data.content) {
      data.content = data.value || ''
    }
    return { ...node, data }
  })
  return {
    nodes,
    edges: (canvasData?.edges || []) as CanvasGraph['edges'],
    viewport: canvasData?.viewport || { x: 100, y: 50, zoom: 0.8 },
  }
}

export const buildSeedCanvas = (options: OpenWorkflowOptions): CanvasGraph => {
  const nodes: CanvasGraph['nodes'] = []
  const edges: CanvasGraph['edges'] = []
  let x = 80

  if (options.seedPrompt) {
    nodes.push({
      id: 'seed_prompt',
      type: 'text',
      position: { x, y: 80 },
      data: { label: '提示词', content: options.seedPrompt },
    })
    x += 360
  }

  if (options.seedImage) {
    nodes.push({
      id: 'seed_image',
      type: 'image',
      position: { x, y: 40 },
      data: {
        label: options.sourceName || '参考图',
        url: options.seedImage,
        sourceType: options.sourceType,
        sourceAssetId: options.sourceAssetId ? String(options.sourceAssetId) : undefined,
      },
    })
    if (options.seedPrompt) {
      edges.push({ id: 'seed_edge', source: 'seed_prompt', target: 'seed_image' })
    }
  }

  (options.relatedAssets || []).forEach((asset, index) => {
    if (!asset.image) return
    nodes.push({
      id: `seed_${asset.category}_${asset.id}`,
      type: 'image',
      position: {
        x: 80 + (index % 4) * 280,
        y: 360 + Math.floor(index / 4) * 240,
      },
      data: {
        label: asset.name,
        url: asset.image,
        sourceType: asset.category,
        sourceAssetId: String(asset.id),
      },
    })
  })

  return {
    nodes,
    edges,
    viewport: { x: 80, y: 40, zoom: 0.8 },
  }
}

export const openOrCreateWorkflow = async (
  options: OpenWorkflowOptions
): Promise<{ id: string; name: string; created: boolean; canvasData: CanvasGraph } | null> => {
  const numericProjectId = Number(options.projectId)
  if (!options.projectId || Number.isNaN(numericProjectId) || numericProjectId <= 0) {
    return null
  }

  const name = createWorkflowName(options.sourceType, options.sourceName)

  if (!options.forceNew && options.sourceType !== 'blank' && options.sourceAssetId) {
    const existing = await workflowsApi.getAll(numericProjectId, { page: 1, size: 100 })
    if (existing.success) {
      const hit = existing.data.list.find(
        (workflow) =>
          workflow.sourceType === options.sourceType &&
          Number(workflow.sourceAssetId) === Number(options.sourceAssetId)
      )
      if (hit) {
        return {
          id: hit.id,
          name: hit.name,
          created: false,
          canvasData: normalizeCanvasData(hit.canvasData),
        }
      }
    }
  }

  const canvasData = buildSeedCanvas(options)
  const response = await workflowsApi.create(numericProjectId, {
    name,
    sourceType: options.sourceType as 'blank' | 'episode' | 'scene' | 'character' | 'object',
    sourceAssetId: options.sourceAssetId,
    canvasData,
  })
  if (!response.success || !response.data?.id) {
    return null
  }

  return {
    id: response.data.id,
    name: response.data.name,
    created: true,
    canvasData: normalizeCanvasData(response.data.canvasData),
  }
}
