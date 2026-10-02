import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { DownloadOutlined, MoreOutlined, PlusOutlined } from '@ant-design/icons'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { projectApi } from '@/api/projectApi'
import { workflowsApi } from '@/features/project/api/workflows'
import { useCanvasStore } from '@/features/infinite-canvas/stores/canvasStore'
import { useCanvasDocumentsStore } from '@/features/infinite-canvas/stores/projectsStore'
import type { Project } from '@/features/infinite-canvas/types'
import { workflowNodeCountLabel } from '@/features/infinite-canvas/workflowSidebar'
import { graphWithoutGenerationTransients } from '@/features/infinite-canvas/utils/videoJobBinding'
import {
  isDraftWorkflowId,
  openOrCreateWorkflow,
  createDraftWorkflowId,
} from '@/lib/workflows'
import {
  persistOpenCanvas,
  releaseCanvasAutosave,
  suppressCanvasAutosave,
} from '@/lib/persistCanvas'
import type { Episode } from '@/types'
import {
  EPISODE_ROW_ACTION_LABELS,
  EPISODE_ROW_ACTIONS,
  WORKFLOW_ROW_ACTION_LABELS,
  WORKFLOW_ROW_ACTIONS,
  asWorkflowSourceType,
  blankWorkflowWithName,
  canvasNameDialogCopy,
  copiedWorkflowName,
  planBlankWorkflow,
  planWorkflowCopy,
  resolveCanvasEpisodeId,
} from '@/features/infinite-canvas/canvasProjectMenu'

type NameDialog =
  | { kind: 'create-episode' }
  | { kind: 'create-workflow' }
  | { kind: 'rename-episode'; episode: Episode }
  | { kind: 'rename-workflow'; workflow: Project }

type RowMenuItem = {
  id: string
  label: string
  danger?: boolean
  onSelect: () => void
}

type RowMenuState = {
  key: string
  top: number
  left: number
  alignUp: boolean
  items: RowMenuItem[]
}

const emptyCanvas = (): Project['canvasData'] => ({
  nodes: [],
  edges: [],
  viewport: { x: 100, y: 50, zoom: 0.8 },
})

function cloneGraph(graph: {
  nodes: unknown[]
  edges: unknown[]
  viewport: { x: number; y: number; zoom: number }
}): Project['canvasData'] {
  return JSON.parse(JSON.stringify(graph)) as Project['canvasData']
}

interface CanvasProjectMenuProps {
  open: boolean
  projectId: string
  episodeId?: string
  currentWorkflowId?: string
  currentWorkflow: Project | null
  episodes: Episode[]
  episodesLoaded: boolean
  workflows: Project[]
  workflowsLoaded: boolean
  onOpenChange: (open: boolean) => void
  onEpisodesChange: (episodes: Episode[]) => void
  onSwitchEpisode: (episodeId: number) => void
  onSwitchWorkflow: (workflowId: string) => void
  onOpenEpisodesTab: () => void
  onLeaveCanvas: () => void
  onExportWorkflow: () => void
  onExportDatabase: () => void
}

export default function CanvasProjectMenu({
  open,
  projectId,
  episodeId,
  currentWorkflowId,
  currentWorkflow,
  episodes,
  episodesLoaded,
  workflows,
  workflowsLoaded,
  onOpenChange,
  onEpisodesChange,
  onSwitchEpisode,
  onSwitchWorkflow,
  onOpenEpisodesTab,
  onLeaveCanvas,
  onExportWorkflow,
  onExportDatabase,
}: CanvasProjectMenuProps) {
  const { notify, confirm } = useFeedback()
  const [rowMenu, setRowMenu] = useState<RowMenuState | null>(null)
  const [nameDialog, setNameDialog] = useState<NameDialog | null>(null)
  const [nameValue, setNameValue] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [creatingWorkflow, setCreatingWorkflow] = useState(false)

  useEffect(() => {
    if (!open) setRowMenu(null)
  }, [open])

  useEffect(() => {
    if (!rowMenu) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('[data-canvas-row-menu]')) return
      setRowMenu(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [rowMenu])

  const numericProjectId = Number(projectId)
  const projectReady = Boolean(projectId) && Number.isInteger(numericProjectId) && numericProjectId > 0

  const existingWorkflowNames = () =>
    useCanvasDocumentsStore
      .getState()
      .projects.filter((item) => String(item.projectId) === String(projectId))
      .map((item) => item.name)

  const toggleRowMenu = (key: string, rect: DOMRect, items: RowMenuItem[]) => {
    setRowMenu((current) => {
      if (current?.key === key) return null
      const spaceBelow = window.innerHeight - rect.bottom
      const alignUp = spaceBelow < 160 && rect.top > spaceBelow
      const width = 180
      const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8)
      return {
        key,
        top: alignUp ? rect.top - 6 : rect.bottom + 6,
        left,
        alignUp,
        items,
      }
    })
  }

  const openNameDialog = (dialog: NameDialog, value: string) => {
    setRowMenu(null)
    onOpenChange(false)
    setNameDialog(dialog)
    setNameValue(value)
  }

  const handleCreateWorkflow = async (name: string) => {
    if (!projectReady || creatingWorkflow) return false
    setCreatingWorkflow(true)
    try {
      const boundEpisodeId = resolveCanvasEpisodeId({
        routeEpisodeId: episodeId,
        sourceType: currentWorkflow?.sourceType,
        sourceAssetId: currentWorkflow?.sourceAssetId,
      })
      const plan = blankWorkflowWithName(planBlankWorkflow({
        routeEpisodeId: boundEpisodeId ? String(boundEpisodeId) : null,
        episodeName: episodes.find((item) => item.id === boundEpisodeId)?.name,
        existingNames: existingWorkflowNames(),
      }), name)
      const result = await openOrCreateWorkflow({
        projectId,
        sourceType: 'blank',
      })
      if (currentWorkflowId) {
        await persistOpenCanvas({ projectId, workflowId: currentWorkflowId, immediate: true })
      }
      if (!result || !isDraftWorkflowId(result.id)) {
        notify.error('新建工作流失败')
        return false
      }
      useCanvasDocumentsStore.getState().createWorkflowDocument({
        id: result.id,
        name: plan.name,
        projectId,
        sourceType: plan.sourceType,
        sourceAssetId: plan.sourceAssetId,
      })
      await useCanvasDocumentsStore.getState().syncProjectWorkflows(projectId, result.id)
      onSwitchWorkflow(result.id)
      notify.success('已新建工作流')
      return true
    } catch {
      notify.error('新建工作流失败')
      return false
    } finally {
      setCreatingWorkflow(false)
    }
  }

  const handleRenameWorkflow = async (workflow: Project, name: string) => {
    let savedName = name
    if (!isDraftWorkflowId(workflow.id)) {
      const response = await workflowsApi.update(numericProjectId, workflow.id, { name })
      if (!response.success) {
        notify.error(response.message || '重命名失败')
        return false
      }
      savedName = response.data?.name || name
    }
    useCanvasDocumentsStore.getState().renameProject(workflow.id, savedName)
    await useCanvasDocumentsStore.getState().syncProjectWorkflows(projectId, currentWorkflowId || workflow.id)
    useCanvasDocumentsStore.getState().renameProject(workflow.id, savedName)
    notify.success('已重命名')
    return true
  }

  const handleCopyWorkflow = async (workflow: Project) => {
    if (!projectReady) return
    setRowMenu(null)
    const live = useCanvasStore.getState()
    const isOpen = workflow.id === currentWorkflowId || workflow.id === live.currentProjectId
    let graph: Project['canvasData']
    let nodeCount: number
    if (isOpen) {
      graph = cloneGraph(graphWithoutGenerationTransients({
        nodes: live.nodes,
        edges: live.edges,
        viewport: live.viewport,
      }))
      nodeCount = graph.nodes.length
    } else if ((workflow.canvasData?.nodes?.length ?? 0) > 0) {
      graph = cloneGraph(workflow.canvasData)
      nodeCount = graph.nodes.length
    } else if (workflow.nodeCount === 0 || isDraftWorkflowId(workflow.id)) {
      graph = emptyCanvas()
      nodeCount = 0
    } else {
      const detail = await workflowsApi.getById(numericProjectId, workflow.id)
      if (!detail.success || !detail.data) {
        notify.error(detail.message || '复制工作流失败')
        return
      }
      if (!detail.data.canvasData && (detail.data.nodeCount ?? 0) > 0) {
        notify.error('暂时读不到画布内容，无法复制')
        return
      }
      graph = cloneGraph({
        nodes: detail.data.canvasData?.nodes || [],
        edges: detail.data.canvasData?.edges || [],
        viewport: detail.data.canvasData?.viewport || emptyCanvas().viewport,
      })
      nodeCount = graph.nodes.length
    }

    const plan = planWorkflowCopy(nodeCount)
    if (plan === 'needs-detail') {
      notify.error('复制工作流失败')
      return
    }
    const sourceType = asWorkflowSourceType(workflow.sourceType)
    const name = copiedWorkflowName(workflow.name, existingWorkflowNames())
    if (plan === 'local-draft') {
      const id = createDraftWorkflowId()
      useCanvasDocumentsStore.getState().createWorkflowDocument({
        id,
        name,
        projectId,
        sourceType,
        sourceAssetId: workflow.sourceAssetId,
      })
      await useCanvasDocumentsStore.getState().syncProjectWorkflows(projectId, id)
      onSwitchWorkflow(id)
      notify.success('已复制工作流')
      return
    }

    if (isOpen && currentWorkflowId) {
      await persistOpenCanvas({ projectId, workflowId: currentWorkflowId, immediate: true })
      const liveAfter = useCanvasStore.getState()
      if (liveAfter.nodes.length > 0) {
        graph = cloneGraph(graphWithoutGenerationTransients({
          nodes: liveAfter.nodes,
          edges: liveAfter.edges,
          viewport: liveAfter.viewport,
        }))
      }
    }
    const response = await workflowsApi.create(numericProjectId, {
      name,
      sourceType,
      ...(typeof workflow.sourceAssetId === 'number' ? { sourceAssetId: workflow.sourceAssetId } : {}),
      canvasData: graph,
    })
    if (!response.success || !response.data?.id) {
      notify.error(response.message || '复制工作流失败')
      return
    }
    useCanvasDocumentsStore.getState().createWorkflowDocument({
      id: response.data.id,
      name: response.data.name || name,
      projectId,
      sourceType: response.data.sourceType || sourceType,
      sourceAssetId: response.data.sourceAssetId ?? workflow.sourceAssetId,
      canvasData: (response.data.canvasData as Project['canvasData'] | undefined) || graph,
    })
    await useCanvasDocumentsStore.getState().syncProjectWorkflows(projectId, response.data.id)
    onSwitchWorkflow(response.data.id)
    notify.success('已复制工作流')
  }

  const handleDeleteWorkflow = async (workflow: Project) => {
    if (!projectReady) return
    setRowMenu(null)
    onOpenChange(false)
    const accepted = await confirm({
      title: '删除工作流',
      description: `确定删除工作流「${workflow.name}」吗？删除后无法恢复。`,
      confirmText: '删除',
      cancelText: '取消',
      tone: 'danger',
    })
    if (!accepted) return

    const liveId = useCanvasStore.getState().currentProjectId
    const isCurrent = workflow.id === currentWorkflowId || workflow.id === liveId
    const suppressed = new Set<string>([workflow.id])
    if (isCurrent && liveId) suppressed.add(liveId)
    if (isCurrent && currentWorkflowId) suppressed.add(currentWorkflowId)
    suppressed.forEach((id) => suppressCanvasAutosave(id))

    if (!isDraftWorkflowId(workflow.id)) {
      const response = await workflowsApi.delete(numericProjectId, workflow.id)
      if (!response.success) {
        suppressed.forEach((id) => releaseCanvasAutosave(id))
        notify.error(response.message || '删除工作流失败')
        return
      }
    }

    useCanvasDocumentsStore.getState().deleteProject(workflow.id)
    await useCanvasDocumentsStore.getState().syncProjectWorkflows(
      projectId,
      isCurrent ? undefined : currentWorkflowId,
    )
    if (isCurrent) {
      const next = workflows.find((item) => item.id !== workflow.id && item.nodeCount !== 0)
      if (next) onSwitchWorkflow(next.id)
      else onLeaveCanvas()
    }
    notify.success('已删除工作流')
  }

  const handleRenameEpisode = async (episode: Episode, name: string) => {
    const response = await projectApi.episodes.update(numericProjectId, episode.id, { name })
    if (!response.success) {
      notify.error(response.message || '重命名失败')
      return false
    }
    const savedName = response.data?.name || name
    onEpisodesChange(episodes.map((item) => (
      item.id === episode.id ? { ...item, ...(response.data || {}), name: savedName } : item
    )))
    notify.success('剧集已重命名')
    return true
  }

  const handleCreateEpisode = async (name: string) => {
    const response = await projectApi.episodes.create(numericProjectId, {
      folderName: name,
      episodeCount: '',
      description: '',
    })
    if (!response.success || !response.data?.id) {
      notify.error(response.message || '创建剧集失败')
      return false
    }
    onEpisodesChange([response.data, ...episodes.filter((item) => item.id !== response.data.id)])
    notify.success('剧集已创建')
    onOpenChange(true)
    return true
  }

  const submitNameDialog = async () => {
    if (!nameDialog || nameSaving || !projectReady) return
    const name = nameValue.trim()
    const copy = canvasNameDialogCopy(nameDialog.kind)
    if (!name) {
      notify.warning(copy.emptyWarning)
      return
    }
    setNameSaving(true)
    try {
      const saved = await saveNameDialog(nameDialog, name)
      if (saved) setNameDialog(null)
    } finally {
      setNameSaving(false)
    }
  }

  const saveNameDialog = async (dialog: NameDialog, name: string) => {
    switch (dialog.kind) {
      case 'rename-workflow':
        return handleRenameWorkflow(dialog.workflow, name)
      case 'rename-episode':
        return handleRenameEpisode(dialog.episode, name)
      case 'create-workflow':
        return handleCreateWorkflow(name)
      case 'create-episode':
        return handleCreateEpisode(name)
    }
  }

  const workflowMenuItems = (workflow: Project): RowMenuItem[] =>
    WORKFLOW_ROW_ACTIONS.map((action) => ({
      id: action,
      label: WORKFLOW_ROW_ACTION_LABELS[action],
      danger: action === 'delete',
      onSelect: () => {
        if (action === 'rename') openNameDialog({ kind: 'rename-workflow', workflow }, workflow.name)
        if (action === 'copy') void handleCopyWorkflow(workflow)
        if (action === 'delete') void handleDeleteWorkflow(workflow)
      },
    }))

  const episodeMenuItems = (episode: Episode): RowMenuItem[] =>
    EPISODE_ROW_ACTIONS.map((action) => ({
      id: action,
      label: EPISODE_ROW_ACTION_LABELS[action],
      onSelect: () => {
        if (action === 'rename') openNameDialog({ kind: 'rename-episode', episode }, episode.name)
        if (action === 'open-in-episodes') onOpenEpisodesTab()
      },
    }))

  const dialogCopy = nameDialog ? canvasNameDialogCopy(nameDialog.kind) : null

  return (
    <>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} />
          <div className="absolute left-0 top-full z-50 mt-2 flex w-[280px] flex-col overflow-hidden rounded-2xl border border-[hsl(var(--outline-variant))]/50 bg-[hsl(var(--surface-container-lowest))]/95 p-1.5 shadow-xl shadow-black/5 backdrop-blur-md">
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto overscroll-contain" onScroll={() => setRowMenu(null)}>
              <div className="px-3 pb-1 pt-2 text-[13px] font-bold text-[hsl(var(--secondary))]">剧集</div>
              {!episodesLoaded ? (
                <div className="px-3 py-2 text-xs text-[hsl(var(--secondary))]">加载剧集中...</div>
              ) : episodes.length === 0 ? (
                <div className="px-3 py-2 text-xs text-[hsl(var(--secondary))]">当前项目还没有剧集</div>
              ) : (
                episodes.map((item) => {
                  const active = String(item.id) === String(episodeId) || currentWorkflow?.sourceAssetId === item.id
                  const menuKey = `episode-${item.id}`
                  return (
                    <div
                      key={item.id}
                      className={`group relative flex items-center rounded-xl ${
                        active
                          ? 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                          : 'hover:bg-[hsl(var(--surface-container-low))]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSwitchEpisode(item.id)}
                        className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 pl-3 pr-9 text-left text-sm"
                      >
                        <span className="truncate font-medium">{item.name}</span>
                        <span className="shrink-0 text-[11px] text-[hsl(var(--secondary))]">
                          {item.code}
                        </span>
                      </button>
                      <RowMenuButton
                        label={`${item.name} 更多操作`}
                        open={rowMenu?.key === menuKey}
                        onToggle={(rect) => toggleRowMenu(menuKey, rect, episodeMenuItems(item))}
                      />
                    </div>
                  )
                })
              )}

              <div className="mx-2 my-1.5 h-px bg-[hsl(var(--outline-variant))]/40" />
              <div className="px-3 pb-1 pt-1 text-[13px] font-bold text-[hsl(var(--secondary))]">工作流</div>
              {!workflowsLoaded ? (
                <div className="px-3 py-2 text-xs text-[hsl(var(--secondary))]">加载工作流中...</div>
              ) : workflows.length === 0 ? (
                <div className="px-3 py-2 text-xs text-[hsl(var(--secondary))]">当前项目还没有工作流</div>
              ) : (
                workflows.map((item) => {
                  const active = item.id === currentWorkflowId
                  const menuKey = `workflow-${item.id}`
                  const nodeCountLabel = workflowNodeCountLabel(item.nodeCount)
                  return (
                    <div
                      key={item.id}
                      className={`group relative flex items-center rounded-xl ${
                        active
                          ? 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                          : 'hover:bg-[hsl(var(--surface-container-low))]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSwitchWorkflow(item.id)}
                        className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 pl-3 pr-9 text-left text-sm"
                      >
                        <span className="truncate font-medium">{item.name}</span>
                        {nodeCountLabel ? (
                          <span className="shrink-0 text-[11px] text-[hsl(var(--secondary))]">
                            {nodeCountLabel}
                          </span>
                        ) : null}
                      </button>
                      <RowMenuButton
                        label={`${item.name} 更多操作`}
                        open={rowMenu?.key === menuKey}
                        onToggle={(rect) => toggleRowMenu(menuKey, rect, workflowMenuItems(item))}
                      />
                    </div>
                  )
                })
              )}
            </div>

            <div className="mx-2 my-1.5 h-px bg-[hsl(var(--outline-variant))]/40" />
            <button
              type="button"
              onClick={() => openNameDialog({ kind: 'create-episode' }, '')}
              disabled={!projectReady}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-[hsl(var(--surface-container-low))] disabled:opacity-50"
            >
              <PlusOutlined style={{ fontSize: 14 }} />
              <span>新建剧集</span>
            </button>
            <button
              type="button"
              onClick={() => openNameDialog({ kind: 'create-workflow' }, '')}
              disabled={!projectReady || creatingWorkflow}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-[hsl(var(--surface-container-low))] disabled:opacity-50"
            >
              <PlusOutlined style={{ fontSize: 14 }} />
              <span>新建工作流</span>
            </button>
            <div className="mx-2 my-1.5 h-px bg-[hsl(var(--outline-variant))]/40" />
            <button
              type="button"
              onClick={onExportWorkflow}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-[hsl(var(--surface-container-low))]"
            >
              <DownloadOutlined style={{ fontSize: 14 }} />
              <span>导出工作流</span>
            </button>
            <button
              type="button"
              onClick={onExportDatabase}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-[hsl(var(--surface-container-low))]"
            >
              <DownloadOutlined style={{ fontSize: 14 }} />
              <span>导出数据库</span>
            </button>
          </div>
        </>
      )}

      {rowMenu && open
        ? createPortal(
          <div
            data-canvas-row-menu=""
            role="menu"
            className="fixed z-[80] min-w-[168px] rounded-xl border border-[hsl(var(--outline-variant))]/50 bg-[hsl(var(--surface-container-lowest))] p-1 text-sm text-[hsl(var(--on-surface))] shadow-lg"
            style={{
              top: rowMenu.top,
              left: rowMenu.left,
              transform: rowMenu.alignUp ? 'translateY(-100%)' : undefined,
            }}
          >
            {rowMenu.items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                onClick={(event) => {
                  event.stopPropagation()
                  setRowMenu(null)
                  item.onSelect()
                }}
                className={`flex w-full items-center rounded-lg px-3 py-2 text-left transition-colors hover:bg-[hsl(var(--surface-container-low))] ${
                  item.danger ? 'text-red-600' : ''
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )
        : null}

      <Dialog
        open={Boolean(nameDialog)}
        onOpenChange={(next) => {
          if (!next && !nameSaving) setNameDialog(null)
        }}
      >
        <DialogContent className="w-full max-w-[480px] overflow-hidden rounded-2xl border-0 bg-[hsl(var(--surface))] p-0">
          <DialogHeader className="px-6 pb-2 pt-6 text-left">
            <DialogTitle className="text-xl font-bold text-[hsl(var(--on-surface))]">
              {dialogCopy?.title}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {dialogCopy?.description}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void submitNameDialog()
            }}
          >
            <div className="space-y-2 px-6 py-4">
              <label className="text-sm font-medium text-[hsl(var(--on-surface))]" htmlFor="canvas-project-menu-name">
                <span className="mr-1 text-red-500">*</span>
                {dialogCopy?.fieldLabel}
              </label>
              <Input
                id="canvas-project-menu-name"
                value={nameValue}
                autoFocus
                onChange={(event) => setNameValue(event.target.value)}
                placeholder={dialogCopy?.placeholder}
                className="h-11 rounded-xl border-none bg-[hsl(var(--surface-container-low))] text-sm"
              />
            </div>
            <div className="px-6 pb-6 pt-2">
              <Button
                type="submit"
                disabled={nameSaving}
                className="h-11 w-full rounded-xl border-0 text-base font-bold text-white signature-gradient"
              >
                {nameSaving ? '保存中...' : dialogCopy?.submitLabel}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function RowMenuButton({
  label,
  open,
  onToggle,
}: {
  label: string
  open: boolean
  onToggle: (rect: DOMRect) => void
}) {
  return (
    <button
      type="button"
      data-canvas-row-menu=""
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={open}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onToggle(event.currentTarget.getBoundingClientRect())
      }}
      className={`absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[hsl(var(--secondary))] transition-opacity hover:bg-[hsl(var(--surface-container-high))] hover:text-[hsl(var(--on-surface))] ${
        open ? 'opacity-100' : 'opacity-50 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100'
      }`}
    >
      <MoreOutlined style={{ fontSize: 14 }} />
    </button>
  )
}
