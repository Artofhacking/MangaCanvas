import { useEffect, useMemo } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowRight, CalendarClock, Clapperboard, Plus, Sparkles, Workflow } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { useWorkflowLauncher } from "@/hooks/useWorkflowLauncher"
import { useCanvasDocumentsStore } from "@/features/infinite-canvas/stores/projectsStore"
import type { WorkflowSourceType } from "@/types"

const sourceTypeMeta: Record<
  WorkflowSourceType,
  { label: string; badgeClassName: string; icon: typeof Sparkles }
> = {
  blank: {
    label: "空白工作流",
    badgeClassName: "bg-[hsl(var(--surface-container-high))] text-[hsl(var(--on-surface-variant))]",
    icon: Sparkles,
  },
  episode: {
    label: "片段工作流",
    badgeClassName: "bg-emerald-500 text-white",
    icon: Clapperboard,
  },
  scene: {
    label: "场景工作流",
    badgeClassName: "bg-[hsl(var(--primary))] text-white",
    icon: Workflow,
  },
  character: {
    label: "角色工作流",
    badgeClassName: "bg-amber-500 text-white",
    icon: Sparkles,
  },
  object: {
    label: "物品工作流",
    badgeClassName: "bg-sky-500 text-white",
    icon: Sparkles,
  },
}

const formatUpdatedAt = (value: Date) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value)

export default function WorkflowsTab() {
  const navigate = useNavigate()
  const { id: projectId } = useParams()
  const { notify } = useFeedback()
  const launchWorkflow = useWorkflowLauncher()
  const projects = useCanvasDocumentsStore((state) => state.projects)
  const initProjects = useCanvasDocumentsStore((state) => state.initProjects)

  useEffect(() => {
    void initProjects()
  }, [initProjects])

  const workflows = useMemo(
    () =>
      projects
        .filter((project) => project.projectId === projectId)
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime()),
    [projectId, projects]
  )

  const handleCreateBlankWorkflow = () => {
    if (!projectId) return

    launchWorkflow({
      projectId,
      sourceType: "blank",
      successMessage: "已创建空白工作流",
    })
  }

  const handleOpenWorkflow = (workflowId: string) => {
    if (!projectId) {
      notify.info("当前项目信息缺失，暂时无法打开工作流")
      return
    }

    navigate(`/project/${projectId}/workflows/${workflowId}`)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
        <div className="rounded-[28px] border border-[hsl(var(--outline-variant))]/40 bg-[linear-gradient(135deg,hsl(var(--surface-container-lowest))_0%,hsl(var(--surface-container-low))_55%,hsl(var(--surface-container))_100%)] p-6 shadow-[0_24px_80px_rgba(42,28,24,0.06)]">
          <div className="flex items-start justify-between gap-6">
            <div>
              <Badge className="mb-4 rounded-full border-0 bg-[hsl(var(--primary))]/10 px-3 py-1 text-[11px] font-bold text-[hsl(var(--primary))]">
                工作流空间
              </Badge>
              <h2 className="text-2xl font-black tracking-tight text-[hsl(var(--on-surface))]">
                把角色、场景、物品串成可复用的创作流
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[hsl(var(--secondary))]">
                在这里集中查看当前项目的所有工作流画布，继续上次编辑，或者从空白画布启动新的编排任务。
              </p>
            </div>
            <div className="hidden rounded-[24px] bg-[hsl(var(--surface-container-lowest))]/80 p-4 shadow-lg md:block">
              <Workflow className="h-10 w-10 text-[hsl(var(--primary))]" />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={handleCreateBlankWorkflow}
              className="signature-gradient rounded-xl border-0 px-5 py-2.5 text-sm font-bold text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              新建空白工作流
            </Button>
            <span className="rounded-full bg-[hsl(var(--surface-container-high))] px-4 py-2 text-xs font-semibold text-[hsl(var(--on-surface-variant))]">
              当前项目共 {workflows.length} 个工作流
            </span>
          </div>
        </div>

        <div className="rounded-[28px] border border-[hsl(var(--outline-variant))]/30 bg-[hsl(var(--surface-container-lowest))] p-6 shadow-[0_18px_50px_rgba(42,28,24,0.05)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[hsl(var(--on-surface))]">继续最近工作</p>
              <p className="text-xs text-[hsl(var(--secondary))]">优先打开最近修改的工作流</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {workflows.slice(0, 3).map((workflow) => {
              const sourceType = (workflow.sourceType as WorkflowSourceType | undefined) ?? "blank"
              const meta = sourceTypeMeta[sourceType]
              const Icon = meta.icon

              return (
                <button
                  key={workflow.id}
                  type="button"
                  onClick={() => handleOpenWorkflow(workflow.id)}
                  className="flex w-full items-center justify-between rounded-2xl border border-[hsl(var(--outline-variant))]/25 bg-[hsl(var(--surface-container-low))] px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--primary))]/25 hover:bg-[hsl(var(--surface-container-lowest))]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--surface-container-high))] text-[hsl(var(--primary))]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[hsl(var(--on-surface))]">{workflow.name}</p>
                      <p className="mt-1 text-[11px] text-[hsl(var(--secondary))]">
                        更新于 {formatUpdatedAt(workflow.updatedAt)}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[hsl(var(--secondary))]" />
                </button>
              )
            })}

            {workflows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[hsl(var(--outline-variant))] bg-[hsl(var(--surface-container-low))]/60 px-4 py-6 text-center">
                <p className="text-sm font-semibold text-[hsl(var(--on-surface))]">还没有工作流</p>
                <p className="mt-1 text-xs leading-5 text-[hsl(var(--secondary))]">
                  先创建一个空白工作流，或者从角色、场景、物品卡片进入无限画布开始创作。
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {workflows.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
          {workflows.map((workflow) => {
            const sourceType = (workflow.sourceType as WorkflowSourceType | undefined) ?? "blank"
            const meta = sourceTypeMeta[sourceType]
            const Icon = meta.icon

            return (
              <div
                key={workflow.id}
                className="group rounded-[24px] border border-[hsl(var(--outline-variant))]/25 bg-[hsl(var(--surface-container-lowest))] p-5 shadow-[0_18px_40px_rgba(42,28,24,0.04)] transition-all hover:-translate-y-1 hover:shadow-[0_28px_60px_rgba(42,28,24,0.08)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-black text-[hsl(var(--on-surface))]">{workflow.name}</h3>
                      <p className="mt-1 text-xs text-[hsl(var(--secondary))]">
                        画布 ID: {workflow.id.replace(/^workflow_/, "").slice(0, 16)}
                      </p>
                    </div>
                  </div>
                  <Badge className={`shrink-0 rounded-full border-0 px-2.5 py-1 text-[10px] font-bold ${meta.badgeClassName}`}>
                    {meta.label}
                  </Badge>
                </div>

                <div className="mt-5 rounded-2xl bg-[hsl(var(--surface-container-low))] p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[hsl(var(--secondary))]">最后修改</span>
                    <span className="font-semibold text-[hsl(var(--on-surface))]">
                      {formatUpdatedAt(workflow.updatedAt)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-[hsl(var(--secondary))]">节点数量</span>
                    <span className="font-semibold text-[hsl(var(--on-surface))]">
                      {workflow.canvasData.nodes.length} 个
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-[hsl(var(--secondary))]">连线数量</span>
                    <span className="font-semibold text-[hsl(var(--on-surface))]">
                      {workflow.canvasData.edges.length} 条
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <div className="text-xs text-[hsl(var(--secondary))]">
                    {workflow.sourceAssetId ? `关联资源 #${workflow.sourceAssetId}` : "未绑定具体资源"}
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleOpenWorkflow(workflow.id)}
                    className="rounded-xl border-0 bg-[hsl(var(--primary))] px-4 py-2 text-xs font-bold text-white hover:opacity-90"
                  >
                    进入工作流
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
