export const WORKFLOW_SOURCE_TYPES = ['blank', 'episode', 'scene', 'character', 'object'] as const

export type MenuWorkflowSourceType = (typeof WORKFLOW_SOURCE_TYPES)[number]

export const WORKFLOW_ROW_ACTIONS = ['rename', 'copy', 'delete'] as const

export const EPISODE_ROW_ACTIONS = ['rename', 'open-in-episodes'] as const

export const WORKFLOW_ROW_ACTION_LABELS: Record<(typeof WORKFLOW_ROW_ACTIONS)[number], string> = {
  rename: '重命名',
  copy: '复制',
  delete: '删除',
}

export const EPISODE_ROW_ACTION_LABELS: Record<(typeof EPISODE_ROW_ACTIONS)[number], string> = {
  rename: '重命名',
  'open-in-episodes': '在剧集管理打开',
}

export function asWorkflowSourceType(value?: string | null): MenuWorkflowSourceType {
  return WORKFLOW_SOURCE_TYPES.includes(value as MenuWorkflowSourceType)
    ? (value as MenuWorkflowSourceType)
    : 'blank'
}

/** Route episode id wins. Otherwise an episode-bound canvas keeps that binding. */
export function resolveCanvasEpisodeId(input: {
  routeEpisodeId?: string | null
  sourceType?: string | null
  sourceAssetId?: number | null
}): number | null {
  const fromRoute = Number(input.routeEpisodeId)
  if (input.routeEpisodeId && Number.isInteger(fromRoute) && fromRoute > 0) return fromRoute
  if (input.sourceType === 'episode') {
    const assetId = Number(input.sourceAssetId)
    if (Number.isInteger(assetId) && assetId > 0) return assetId
  }
  return null
}

function nextAvailableName(base: string, existingNames: string[], at: (index: number) => string): string {
  const taken = new Set(existingNames.map((name) => name.trim()).filter(Boolean))
  if (!taken.has(base)) return base
  let index = 2
  while (taken.has(at(index))) index += 1
  return at(index)
}

export function blankWorkflowName(
  episodeId: number | null,
  episodeName: string | null | undefined,
  existingNames: string[],
): string {
  if (!episodeId) return '空白工作流'
  const trimmed = episodeName?.trim()
  const base = trimmed ? `${trimmed} 工作流` : `剧集 ${episodeId} 工作流`
  return nextAvailableName(base, existingNames, (index) => `${base} ${index}`)
}

export function planBlankWorkflow(input: {
  routeEpisodeId?: string | null
  sourceType?: string | null
  sourceAssetId?: number | null
  episodeName?: string | null
  existingNames: string[]
}): {
  name: string
  sourceType: 'blank' | 'episode'
  sourceAssetId?: number
  /** A blank canvas has no nodes, so it stays a local draft until the first real save. */
  persist: 'local-draft'
} {
  const episodeId = resolveCanvasEpisodeId(input)
  return {
    name: blankWorkflowName(episodeId, input.episodeName, input.existingNames),
    sourceType: episodeId ? 'episode' : 'blank',
    sourceAssetId: episodeId ?? undefined,
    persist: 'local-draft',
  }
}

export function copiedWorkflowName(name: string, existingNames: string[]): string {
  const trimmed = name.trim() || '未命名工作流'
  const base = `${trimmed} (复制)`
  return nextAvailableName(base, existingNames, (index) => `${trimmed} (复制 ${index})`)
}

export type WorkflowCopyPersist = 'local-draft' | 'server' | 'needs-detail'

/** 0 nodes stay local. A missing count still needs the detail canvas before we insert a row. */
export function planWorkflowCopy(nodeCount: number | undefined): WorkflowCopyPersist {
  if (nodeCount === 0) return 'local-draft'
  if (typeof nodeCount === 'number') return 'server'
  return 'needs-detail'
}
