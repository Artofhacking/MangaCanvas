import { useCallback, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import { X } from "lucide-react"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
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
import type { Character, CharacterCreateData, CharacterEditData } from "@/types"
import ShapingPanel from "@/features/project/ShapingPanel"
import { normalizeShapingStatus } from "@/features/project/shaping"
import CharacterForm, { type CharacterFormValues } from "./CharacterForm"
import { useCreditQuote } from "@/hooks/useCreditQuote"
import { aspectToSize } from "@/lib/generateAssetImage"

interface CharacterCreatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate?: (data: CharacterCreateData) => void
  onUpdate?: (data: CharacterEditData) => void
  initialData?: Character | null
  mode?: "create" | "edit"
  projectId?: number | null
  onSetPromptLock?: (locked: boolean) => Promise<void>
  lockingPrompt?: boolean
}

export default function CharacterCreator({
  open,
  onOpenChange,
  onUpdate,
  initialData,
  mode = "create",
  projectId,
  onSetPromptLock,
  lockingPrompt = false,
}: CharacterCreatorProps) {
  const { notify } = useFeedback()
  const isEditMode = Boolean(initialData)
  const valuesRef = useRef<CharacterFormValues | null>(null)
  const [quoteValues, setQuoteValues] = useState<CharacterFormValues | null>(null)
  const { costLabel, blocked } = useCreditQuote(
    quoteValues?.model
      ? {
          model: quoteValues.model,
          modality: "image",
          quality: "medium",
          size: aspectToSize[quoteValues.aspectRatio || "1:1"],
          n: 1,
          projectId: projectId ? Number(projectId) : undefined,
        }
      : null
  )
  const { panelOpen, highlightTasks, taskPanelRef, handleOpenTaskList, revealTaskPanel } =
    useCollapsibleTaskPanel(open)
  const allTasks = useAssetGenerationStore((state) => state.tasks)
  const storeTasks = tasksForAsset(allTasks, "character", projectId, initialData?.id)
  const tasks = withExistingAssetResult(storeTasks, {
    kind: "character",
    projectId: Number(projectId) || 0,
    assetId: initialData?.id,
    name: initialData?.name || "",
    prompt: initialData?.description,
    model: initialData?.model,
    imageUrl: initialData?.hasImage ? initialData.image : "",
  })
  const runningKey = projectId ? assetTaskKey("character", Number(projectId), initialData?.id) : ""
  const submitting = useAssetGenerationStore((state) => Boolean(runningKey && state.runningKeys[runningKey]))
  const startGeneration = useAssetGenerationStore((state) => state.start)
  const setCover = useAssetGenerationStore((state) => state.setCover)
  const shapingStatus = normalizeShapingStatus(initialData?.shapingStatus)
  const promptLocked = shapingStatus !== "unset"
  const coverLocked = shapingStatus === "final"

  const handleValuesChange = useCallback((values: CharacterFormValues) => {
    valuesRef.current = values
    setQuoteValues(values)
  }, [])

  const currentValues = () => valuesRef.current

  const handleSave = () => {
    const values = currentValues()
    if (!values?.name.trim()) {
      notify.warning("请输入角色名称")
      return
    }
    if (!values.gender) {
      notify.warning("请选择性别")
      return
    }
    if (!values.ageGroup) {
      notify.warning("请选择年龄段")
      return
    }
    if (!initialData) return
    onUpdate?.({
      id: initialData.id,
      name: values.name.trim(),
      gender: values.gender,
      ageGroup: values.ageGroup,
      genMethod: "model",
      model: values.model,
      style: values.style,
      description: values.prompt,
      aspectRatio: values.aspectRatio,
    })
    notify.success("角色已保存")
  }

  const handleGenerate = () => {
    const values = currentValues()
    if (!values?.name.trim()) {
      notify.warning("请输入角色名称")
      return
    }
    if (!values.gender) {
      notify.warning("请选择性别")
      return
    }
    if (!values.ageGroup) {
      notify.warning("请选择年龄段")
      return
    }
    if (!values.prompt.trim()) {
      notify.warning("请输入角色描述")
      return
    }
    if (!values.model) {
      notify.warning("暂无可用生图模型")
      return
    }
    if (!projectId) {
      notify.warning("缺少项目信息，无法生成")
      return
    }
    if (coverLocked) {
      notify.warning("已定妆，换定妆前请先解锁")
      return
    }
    if (blocked) {
      notify.warning(blocked)
      return
    }
    revealTaskPanel()
    void startGeneration({
      kind: "character",
      projectId: Number(projectId),
      assetId: initialData?.id,
      name: values.name.trim(),
      prompt: values.prompt.trim(),
      model: values.model,
      aspectRatio: values.aspectRatio,
      quality: values.quality,
      clarity: values.clarity,
      n: values.quantity,
      referenceImages: values.referenceImages,
      extras: {
        gender: values.gender,
        ageGroup: values.ageGroup,
        style: values.style,
      },
    }).then((result) => {
      if (result === "ok") {
        notify.success(initialData ? "角色已重新生成并保存" : "角色已生成并加入素材库")
      }
    }).catch((error) => {
      notify.error(error instanceof Error ? error.message : "生成失败")
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[900px] sm:max-w-[900px] p-0 overflow-hidden bg-[hsl(var(--surface))]" style={{ maxWidth: "900px" }} hideCloseButton>
        <SheetTitle className="sr-only">{isEditMode ? "编辑角色" : "创建角色"}</SheetTitle>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface))]">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-5 h-5" />
            </Button>
            <h2 className="text-xl font-bold text-[hsl(var(--on-surface))]">{isEditMode ? "编辑角色" : "创建角色"}</h2>
          </div>
          <GenerationTaskListButton
            label="角色生成任务列表"
            count={tasks.length}
            running={submitting || tasks.some((task) => task.status === "running")}
            expanded={panelOpen}
            onClick={handleOpenTaskList}
          />
        </div>

        <div className="flex h-[calc(100vh-70px)]">
          <div
            className={`flex h-full flex-col overflow-y-auto p-6 pb-24 ${
              panelOpen ? "w-[52%] border-r border-[hsl(var(--outline-variant))]/15" : "w-full"
            }`}
          >
            {initialData ? (
              <div className="mb-6">
                <ShapingPanel
                  status={shapingStatus}
                  prompt={initialData.description}
                  busy={lockingPrompt}
                  onLock={onSetPromptLock ? () => void onSetPromptLock(true) : undefined}
                  onUnlock={onSetPromptLock ? () => void onSetPromptLock(false) : undefined}
                />
              </div>
            ) : null}
            <CharacterForm
              mode={mode}
              initialData={initialData}
              hideActions
              promptLocked={promptLocked}
              onValuesChange={handleValuesChange}
            />
          </div>
          {panelOpen ? (
            <GenerationTaskPanel
              tasks={tasks}
              highlight={highlightTasks}
              panelRef={taskPanelRef}
              onSetCover={
                coverLocked
                  ? () => {
                      throw new Error("已定妆，换定妆前请先解锁")
                    }
                  : (task, url) => setCover(task.id, url)
              }
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
            costLabel={costLabel}
            blockedReason={coverLocked ? "已定妆，换定妆前请先解锁" : blocked}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
