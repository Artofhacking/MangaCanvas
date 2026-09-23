import { workflowsApi } from '@/features/project/api/workflows'
import type { CanvasLaunchSource, WorkflowSourceType } from '@/types'
import { openAssetSeedNodes, resolveAssetMedia, dominantAssetNode } from './assetSeed'
import { buildEpisodePlotCanvas, hasGeneratedCanvasWork, isLegacyEpisodeCanvas, shouldRebuildEpisodeCanvas } from './plotActs'

export { isLegacyEpisodeCanvas, shouldRebuildEpisodeCanvas }

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
  video?: string
  prompt?: string
  mediaType?: string
  hasImage?: boolean
  hasVideo?: boolean
  category: 'character' | 'scene' | 'object'
}

export type OpenWorkflowOptions = {
  projectId: string
  sourceType: WorkflowSourceType
  sourceName?: string
  sourceAssetId?: number
  seedImage?: string
  seedVideo?: string
  seedPrompt?: string
  seedMediaType?: string
  seedHasImage?: boolean
  seedHasVideo?: boolean
  relatedAssets?: WorkflowSeedAsset[]
  forceNew?: boolean
}

export function toCanvasLaunchSource(asset: {
  id: number
  name: string
  image?: string
  description?: string
  video?: string
  mediaType?: string
  hasImage?: boolean
  hasVideo?: boolean
}): CanvasLaunchSource {
  return {
    id: asset.id,
    name: asset.name,
    image: asset.image,
    description: asset.description,
    video: asset.video,
    mediaType: asset.mediaType,
    hasImage: asset.hasImage,
    hasVideo: asset.hasVideo,
  }
}

export function toWorkflowSeedAsset(
  item: {
    id: number
    name: string
    image?: string | null
    description?: string | null
    prompt?: string | null
    video?: string | null
    mediaType?: string | null
    hasImage?: boolean
    hasCover?: boolean
    hasVideo?: boolean
  },
  category: WorkflowSeedAsset['category'],
): WorkflowSeedAsset {
  const prompt = (item.prompt || item.description || '').trim()
  return {
    id: item.id,
    name: item.name,
    image: item.image || undefined,
    video: item.video || undefined,
    prompt: prompt || undefined,
    mediaType: item.mediaType || undefined,
    hasImage: item.hasImage ?? item.hasCover,
    hasVideo: item.hasVideo,
    category,
  }
}

export function seedOptionsFromLaunch(source?: CanvasLaunchSource | null) {
  return {
    sourceName: source?.name,
    sourceAssetId: source?.id,
    seedImage: source?.image,
    seedVideo: source?.video,
    seedPrompt: source?.description,
    seedMediaType: source?.mediaType,
    seedHasImage: source?.hasImage,
    seedHasVideo: source?.hasVideo,
  }
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
    if (data.loading && !data.url) {
      data.loading = false
      if (!data.error) data.error = '生成中断，请重新生成'
    }
    return { ...node, data }
  })
  return {
    nodes,
    edges: (canvasData?.edges || []) as CanvasGraph['edges'],
    viewport: canvasData?.viewport || { x: 100, y: 50, zoom: 0.8 },
  }
}

const seedMediaInput = (options: OpenWorkflowOptions) => ({
  name: options.sourceName,
  prompt: options.seedPrompt,
  image: options.seedImage,
  video: options.seedVideo,
  mediaType: options.seedMediaType,
  hasImage: options.seedHasImage,
  hasVideo: options.seedHasVideo,
})

export function shouldRepairAssetSeedCanvas(
  canvas?: { nodes?: Array<{ id?: string; type?: string; data?: Record<string, unknown> }> } | null,
  options?: OpenWorkflowOptions,
) {
  if (!options || options.sourceType === 'episode' || options.sourceType === 'blank') return false
  if (hasGeneratedCanvasWork(canvas)) return false
  const nodes = canvas?.nodes || []
  if (!nodes.length) return false
  if (nodes.some((node) => !String(node.id || '').startsWith('seed_'))) return false

  const resolved = resolveAssetMedia(seedMediaInput(options))
  const types = new Set(nodes.map((node) => node.type))
  if (resolved.kind === 'text' || resolved.kind === 'none') {
    return types.has('image') || types.has('video')
  }
  if (resolved.kind === 'video') return !types.has('video')
  return !nodes.some((node) => node.type === 'image' && String(node.data?.url || '') === resolved.imageUrl)
}

export const buildSeedCanvas = (options: OpenWorkflowOptions): CanvasGraph => {
  if (options.sourceType === 'episode') {
    return buildEpisodePlotCanvas(options)
  }

  const sourceExtra = {
    sourceType: options.sourceType,
    sourceAssetId: options.sourceAssetId ? String(options.sourceAssetId) : undefined,
  }
  const primary = openAssetSeedNodes(seedMediaInput(options), sourceExtra)
  const nodes: CanvasGraph['nodes'] = [...primary.nodes]
  const edges: CanvasGraph['edges'] = [...primary.edges]

  let placed = 0
  for (const asset of options.relatedAssets || []) {
    const node = dominantAssetNode(
      asset,
      {
        x: 80 + (placed % 4) * 280,
        y: 360 + Math.floor(placed / 4) * 240,
      },
      `seed_${asset.category}_${asset.id}`,
      {
        sourceType: asset.category,
        sourceAssetId: String(asset.id),
      },
    )
    if (!node) continue
    nodes.push(node)
    placed += 1
  }

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
        const current = normalizeCanvasData(hit.canvasData)
        const rebuild =
          (options.sourceType === 'episode' && shouldRebuildEpisodeCanvas(current)) ||
          shouldRepairAssetSeedCanvas(current, options)
        if (rebuild) {
          const canvasData = buildSeedCanvas(options)
          const updated = await workflowsApi.update(numericProjectId, hit.id, { canvasData })
          return {
            id: hit.id,
            name: hit.name,
            created: false,
            canvasData: normalizeCanvasData(updated.data?.canvasData || canvasData),
          }
        }
        return {
          id: hit.id,
          name: hit.name,
          created: false,
          canvasData: current,
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
