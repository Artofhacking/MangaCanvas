import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import { X } from "lucide-react"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { ImageGenerationForm } from "@/components/forms/ImageGenerationForm"
import { defaultImageGenerationConfig, type ImageGenerationConfig } from "@/lib/generateSettings"
import GenerationTaskPanel, {
  AssetEditorActions,
  GenerationTaskListButton,
} from "@/components/generation/GenerationTaskPanel"
import { useCollapsibleTaskPanel } from "@/hooks/useCollapsibleTaskPanel"
import {
  assetTaskKey,
  tasksForAsset,
  useAssetGenerationStore,
  withExistingAssetResult,
} from "@/store/assetGenerationStore"
import type { ObjectItem } from "@/types"

export interface ObjectCreateData {
  name: string
  genMethod: "model" | "upload"
  model?: string
  prompt?: string
  aspectRatio?: string
  quantity?: number
  referenceImage?: string
  referenceImages?: string[]
}

export interface ObjectEditData extends ObjectCreateData {
  id: number
}

interface ObjectCreatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate?: (data: ObjectCreateData) => void
  onUpdate?: (data: ObjectEditData) => void
  initialData?: ObjectItem | null
  mode?: "create" | "edit"
  projectId?: number | null
}

export default function ObjectCreator({
  open,
  onOpenChange,
  onUpdate,
  initialData,
  projectId,
}: ObjectCreatorProps) {
  const { notify } = useFeedback()
  const [objectName, setObjectName] = useState("")
  const [generationConfig, setGenerationConfig] = useState<ImageGenerationConfig>(() => defaultImageGenerationConfig())
  const { panelOpen, highlightTasks, taskPanelRef, handleOpenTaskList, revealTaskPanel } =
    useCollapsibleTaskPanel(open)
  const allTasks = useAssetGenerationStore((state) => state.tasks)
  const storeTasks = tasksForAsset(allTasks, "object", projectId, initialData?.id)
  const tasks = withExistingAssetResult(storeTasks, {
    kind: "object",
    projectId: Number(projectId) || 0,
    assetId: initialData?.id,
    name: initialData?.name || "",
    prompt: initialData?.description,
    model: initialData?.model,
    imageUrl: initialData?.hasImage ? initialData.image : "",
  })
  const runningKey = projectId ? assetTaskKey("object", Number(projectId), initialData?.id) : ""
  const submitting = useAssetGenerationStore((state) => Boolean(runningKey && state.runningKeys[runningKey]))
  const startGeneration = useAssetGenerationStore((state) => state.start)
  const setCover = useAssetGenerationStore((state) => state.setCover)

  const resetForm = () => {
    setObjectName("")
    setGenerationConfig(defaultImageGenerationConfig())
  }

  useEffect(() => {
    if (!open) return
    if (initialData) {
      setObjectName(initialData.name)
      setGenerationConfig((prev) => ({
        ...prev,
        prompt: initialData.description || "",
        aspectRatio: initialData.aspectRatio || prev.aspectRatio,
        referenceImages: initialData.hasImage && initialData.image ? [initialData.image] : [],
      }))
    } else {
      resetForm()
    }
  }, [initialData, open])

  const handleSave = () => {
    if (!objectName.trim()) {
      notify.warning("请输入物品名称")
      return
    }
    if (!initialData) return
    onUpdate?.({
      id: initialData.id,
      name: objectName.trim(),
      genMethod: "model",
      model: generationConfig.model,
      prompt: generationConfig.prompt.trim(),
      aspectRatio: generationConfig.aspectRatio,
      quantity: generationConfig.quantity,
    })
    notify.success("物品已保存")
  }

  const handleGenerate = () => {
    if (!objectName.trim()) {
      notify.warning("请输入物品名称")
      return
    }
    if (!generationConfig.prompt.trim()) {
      notify.warning("请输入物品描述")
      return
    }
    if (!generationConfig.model) {
      notify.warning("暂无可用生图模型")
      return
    }
    if (!projectId) {
      notify.warning("缺少项目信息，无法生成")
      return
    }
    revealTaskPanel()
    void startGeneration({
      kind: "object",
      projectId: Number(projectId),
      assetId: initialData?.id,
      name: objectName.trim(),
      prompt: generationConfig.prompt.trim(),
      model: generationConfig.model,
      aspectRatio: generationConfig.aspectRatio,
      quality: generationConfig.quality,
      clarity: generationConfig.clarity,
      n: generationConfig.quantity,
      referenceImages: generationConfig.referenceImages,
    }).then((result) => {
      if (result === "ok") {
        notify.success(initialData ? "物品已重新生成并保存" : "物品已生成并加入素材库")
      }
    }).catch((error) => {
      notify.error(error instanceof Error ? error.message : "生成失败")
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[900px] sm:max-w-[900px] p-0 overflow-hidden bg-[hsl(var(--surface))]" style={{ maxWidth: "900px" }} hideCloseButton>
        <SheetTitle className="sr-only">{initialData ? "编辑物品" : "创建物品"}</SheetTitle>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface))]">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-5 h-5" />
            </Button>
            <h2 className="text-xl font-bold text-[hsl(var(--on-surface))]">{initialData ? "编辑物品" : "创建物品"}</h2>
          </div>
          <GenerationTaskListButton
            label="物品生成任务列表"
            count={tasks.length}
            running={submitting || tasks.some((task) => task.status === "running")}
            expanded={panelOpen}
            onClick={handleOpenTaskList}
          />
        </div>

        <div className="flex h-[calc(100vh-70px)]">
          <div
            className={`flex h-full flex-col space-y-6 overflow-y-auto p-6 pb-24 ${
              panelOpen ? "w-[52%] border-r border-[hsl(var(--outline-variant))]/15" : "w-full"
            }`}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium text-[hsl(var(--on-surface))]">
                <span className="text-red-500 mr-1">*</span>物品名称
              </label>
              <Input
                value={objectName}
                onChange={(e) => setObjectName(e.target.value)}
                placeholder="请输入"
                className="h-11 rounded-xl bg-[hsl(var(--surface-container-low))] border-none text-sm placeholder:text-[hsl(var(--secondary))] focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))]"
              />
            </div>
            <ImageGenerationForm directory="objects" value={generationConfig} onChange={setGenerationConfig} />
          </div>
          {panelOpen ? (
            <GenerationTaskPanel
              tasks={tasks}
              highlight={highlightTasks}
              panelRef={taskPanelRef}
              onSetCover={(task, url) => setCover(task.id, url)}
            />
          ) : null}
        </div>

        <div
          className={`absolute bottom-0 left-0 p-4 bg-gradient-to-t from-[hsl(var(--surface))] to-transparent ${
            panelOpen ? "w-[52%]" : "w-full"
          }`}
        >
          <AssetEditorActions
            hasExisting={Boolean(initialData)}
            submitting={submitting}
            onSave={handleSave}
            onGenerate={handleGenerate}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
