import { Loader2, Image as ImageIcon, LayoutList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import type { AssetGenTask } from "@/store/assetGenerationStore"
import type { RefObject } from "react"

interface GenerationTaskPanelProps {
  tasks: AssetGenTask[]
  highlight?: boolean
  panelRef?: RefObject<HTMLDivElement>
  onSetCover?: (task: AssetGenTask, imageUrl: string) => Promise<void> | void
}

function candidateUrls(task: AssetGenTask): string[] {
  if (task.imageUrls?.length) return task.imageUrls
  return task.imageUrl ? [task.imageUrl] : []
}

export default function GenerationTaskPanel({
  tasks,
  highlight = false,
  panelRef,
  onSetCover,
}: GenerationTaskPanelProps) {
  const { notify } = useFeedback()

  const handleSetCover = async (task: AssetGenTask, imageUrl: string) => {
    if (!onSetCover || task.imageUrl === imageUrl) return
    try {
      await onSetCover(task, imageUrl)
      notify.success("已设为封面")
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "设置封面失败")
    }
  }

  return (
    <div
      ref={panelRef}
      className={`flex h-full min-w-[280px] flex-1 flex-col bg-[hsl(var(--surface-container-low))]/40 transition-shadow ${
        highlight ? "ring-2 ring-[hsl(var(--primary))] ring-inset" : ""
      }`}
    >
      <div className="border-b border-[hsl(var(--outline-variant))]/15 px-6 py-4">
        <p className="text-sm font-bold text-[hsl(var(--on-surface))]">生成进度与结果</p>
        <p className="mt-1 text-xs text-[hsl(var(--secondary))]">提交后在这里查看任务状态和出图结果</p>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {tasks.length === 0 ? (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-[24px] border border-dashed border-[hsl(var(--outline-variant))]/30 bg-[hsl(var(--surface-container-lowest))]/70 px-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--surface-container-high))] text-[hsl(var(--secondary))]">
              <ImageIcon className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-[hsl(var(--on-surface))]">还没有生成任务</p>
            <p className="mt-2 text-xs leading-5 text-[hsl(var(--secondary))]">
              填写名称和提示词后提交，进度和图片会显示在这里。
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="overflow-hidden rounded-[24px] border border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface-container-lowest))] shadow-sm"
            >
              <div className="bg-[hsl(var(--surface-container-low))]">
                {candidateUrls(task).length > 1 ? (
                  <div className="grid grid-cols-2 gap-1 p-1">
                    {candidateUrls(task).map((url, index) => {
                      const isCover = url === task.imageUrl
                      return (
                        <button
                          key={`${task.id}-${url}-${index}`}
                          type="button"
                          onClick={() => void handleSetCover(task, url)}
                          className={`group relative overflow-hidden rounded-xl ${
                            isCover ? "ring-2 ring-[hsl(var(--primary))]" : ""
                          }`}
                        >
                          <img src={url} alt={`${task.name} 候选 ${index + 1}`} className="aspect-square w-full object-cover" />
                          <span
                            className={`absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isCover
                                ? "signature-gradient text-white"
                                : "bg-black/45 text-white opacity-0 group-hover:opacity-100"
                            }`}
                          >
                            {isCover ? "封面" : "设为封面"}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : task.imageUrl ? (
                  <div className="aspect-[3/2]">
                    <img src={task.imageUrl} alt={task.name} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex aspect-[3/2] flex-col items-center justify-center gap-3 text-[hsl(var(--secondary))]">
                    {task.status === "running" ? (
                      <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
                    ) : (
                      <ImageIcon className="h-8 w-8" />
                    )}
                    <p className="text-xs">{task.progress}</p>
                  </div>
                )}
              </div>
              <div className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-bold text-[hsl(var(--on-surface))]">{task.name}</p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      task.status === "succeeded"
                        ? "bg-[hsl(var(--primary))] text-white"
                        : task.status === "failed"
                          ? "bg-red-500 text-white"
                          : "bg-[hsl(var(--surface-container-high))] text-[hsl(var(--on-surface-variant))]"
                    }`}
                  >
                    {task.status === "succeeded" ? "已完成" : task.status === "failed" ? "失败" : "生成中"}
                  </span>
                </div>
                <p className="line-clamp-2 text-xs leading-5 text-[hsl(var(--secondary))]">{task.prompt}</p>
                {task.error ? <p className="text-xs text-red-500">{task.error}</p> : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function GenerationTaskListButton({
  label,
  count,
  running = false,
  expanded = false,
  onClick,
}: {
  label: string
  count: number
  running?: boolean
  expanded?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className="inline-flex items-center gap-2 rounded-full signature-gradient px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
    >
      <LayoutList className="h-4 w-4" />
      {label}
      {running ? (
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
      ) : null}
      {count ? <span className="rounded-full bg-white/20 px-1.5 text-[11px] leading-5">{count}</span> : null}
    </button>
  )
}

export function AssetEditorActions({
  hasExisting,
  submitting,
  onSave,
  onGenerate,
}: {
  hasExisting: boolean
  submitting: boolean
  onSave: () => void
  onGenerate: () => void
}) {
  const generateLabel = submitting ? (
    <span className="inline-flex items-center gap-2">
      <Loader2 className="h-5 w-5 animate-spin" />
      生成中...
    </span>
  ) : (
    "生成"
  )
  if (!hasExisting) {
    return (
      <div className="space-y-2">
        <Button
          type="button"
          onClick={onGenerate}
          disabled={submitting}
          className="w-full h-12 signature-gradient text-white rounded-xl font-bold text-lg border-0 disabled:opacity-60"
        >
          {generateLabel}
        </Button>
        <p className="text-center text-xs text-[hsl(var(--secondary))]">
          生成成功后将自动加入素材库
        </p>
      </div>
    )
  }
  return (
    <div className="flex gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={onSave}
        disabled={submitting}
        className="h-12 flex-1 rounded-xl border-[hsl(var(--outline-variant))] bg-[hsl(var(--surface-container-low))] text-base font-bold text-[hsl(var(--on-surface))] hover:bg-[hsl(var(--surface-container-high))]"
      >
        保存
      </Button>
      <Button
        type="button"
        onClick={onGenerate}
        disabled={submitting}
        className="h-12 flex-1 signature-gradient rounded-xl border-0 text-base font-bold text-white disabled:opacity-60"
      >
        {generateLabel}
      </Button>
    </div>
  )
}

