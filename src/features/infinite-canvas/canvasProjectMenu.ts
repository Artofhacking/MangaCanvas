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

export type CanvasNameDialogKind =
  | 'create-episode'
  | 'rename-episode'
  | 'create-workflow'
  | 'rename-workflow'

export type CanvasNameDialogCopy = {
  title: string
  description: string
  fieldLabel: string
  placeholder: string
  submitLabel: string
  emptyWarning: string
}

const episodeNameField = {
  fieldLabel: '剧集名称',
  placeholder: '请输入剧集名称',
  emptyWarning: '请输入剧集名称',
} as const

const workflowNameField = {
  fieldLabel: '工作流名称',
  placeholder: '请输入工作流名称',
  emptyWarning: '请输入工作流名称',
} as const

/** Shared copy for the canvas project menu name dialog. Create actions use「创建」. */
export function canvasNameDialogCopy(kind: CanvasNameDialogKind): CanvasNameDialogCopy {
  switch (kind) {
    case 'create-episode':
      return {
        title: '新建剧集',
        description: '只填写剧集名称',
        submitLabel: '创建',
        ...episodeNameField,
      }
    case 'rename-episode':
      return {
        title: '重命名剧集',
        description: '修改名称',
        submitLabel: '保存',
        ...episodeNameField,
      }
    case 'create-workflow':
      return {
        title: '新建工作流',
        description: '只填写工作流名称',
        submitLabel: '创建',
        ...workflowNameField,
      }
    case 'rename-workflow':
      return {
        title: '重命名工作流',
        description: '修改名称',
        submitLabel: '保存',
        ...workflowNameField,
      }
  }
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

/** Keep episode binding and the 0-node local draft; only the display name comes from the dialog. */
export function blankWorkflowWithName(
  plan: ReturnType<typeof planBlankWorkflow>,
  name: string,
): ReturnType<typeof planBlankWorkflow> {
  return { ...plan, name: name.trim() }
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
