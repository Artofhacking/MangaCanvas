import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  X,
  HelpCircle,
  ChevronDown,
  Check,
} from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { useImageModels } from "@/features/infinite-canvas/hooks"
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
import type { Scene } from "@/types"

const fallbackSceneModels = [
  { id: "jimeng-3", name: "即梦 3.0", description: "中文语义强，适合场景氛围" },
]

export interface SceneCreateData {
  name: string
  genMethod: string
  model: string
  description: string
  distance: number
  zoom: number
  status: "draft" | "in-use"
  referenceImage?: string
}

export interface SceneEditData extends SceneCreateData {
  id: number
}

interface SceneCreatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate?: (data: SceneCreateData) => void
  onUpdate?: (data: SceneEditData) => void
  initialData?: Scene | null
  mode?: 'create' | 'edit' | 'generate'
  projectId?: number | null
}

export default function SceneCreator({ 
  open, 
  onOpenChange, 
  onUpdate, 
  initialData, 
  projectId,
}: SceneCreatorProps) {
  const { notify } = useFeedback()
  const { models: imageModels, loading: modelsLoading, error: modelsError, refetch } = useImageModels()
  const [selectedModel, setSelectedModel] = useState<string>("")
  const allTasks = useAssetGenerationStore((state) => state.tasks)
  const storeTasks = tasksForAsset(allTasks, "scene", projectId, initialData?.id)
  const tasks = withExistingAssetResult(storeTasks, {
    kind: "scene",
    projectId: Number(projectId) || 0,
    assetId: initialData?.id,
    name: initialData?.name || "",
    prompt: initialData?.description,
    model: initialData?.model,
    imageUrl: initialData?.hasImage ? initialData.image : "",
  })
  const runningKey = projectId ? assetTaskKey("scene", Number(projectId), initialData?.id) : ""
  const submitting = useAssetGenerationStore((state) => Boolean(runningKey && state.runningKeys[runningKey]))
  const startGeneration = useAssetGenerationStore((state) => state.start)
  const { panelOpen, highlightTasks, taskPanelRef, handleOpenTaskList, revealTaskPanel } =
    useCollapsibleTaskPanel(open)

  const [distance, setDistance] = useState([8.0])
  const [zoom, setZoom] = useState(0.6)
  const [sceneName, setSceneName] = useState("")
  const [description, setDescription] = useState("")
  // 用于防止 useEffect 重复执行的 ref
  const initializedRef = useRef(false)
  const prevOpenRef = useRef(open)

  const availableModels = imageModels.length > 0 ? imageModels : fallbackSceneModels

  useEffect(() => {
    if (modelsLoading && imageModels.length === 0) return
    if (!selectedModel || !availableModels.some((model) => model.id === selectedModel)) {
      setSelectedModel(availableModels[0]?.id || "")
    }
  }, [availableModels, imageModels.length, modelsLoading, selectedModel])

  // 重置表单的函数
  const resetForm = () => {
    setSceneName("")
    setDescription("")
    setSelectedModel(availableModels[0]?.id || "")
    setDistance([8.0])
    setZoom(0.6)
  }

  // 编辑模式下回填数据 / 关闭时重置表单
  useEffect(() => {
    // 只在 open 从 false 变为 true 时执行初始化
    const isOpening = open && !prevOpenRef.current
    prevOpenRef.current = open
    
    if (!open) {
      initializedRef.current = false
      return
    }
    
    // 只在打开时执行一次
    if (!isOpening || initializedRef.current) return
    
    initializedRef.current = true
    
    if (initialData) {
      setSceneName(initialData.name)
      setSelectedModel(initialData.model || imageModels[0]?.id || "")
      setDescription(initialData.description || "")
    } else {
      resetForm()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleSave = () => {
    if (!sceneName.trim()) {
      notify.warning("请输入场景名称")
      return
    }
    if (!initialData) return

    onUpdate?.({
      id: initialData.id,
      name: sceneName.trim(),
      genMethod: "model",
      model: selectedModel,
      description,
      distance: distance[0],
      zoom,
      status: initialData.status === "in-use" ? "in-use" : "draft",
    })
    notify.success("场景已保存")
  }

  const handleGenerate = () => {
    if (!sceneName.trim()) {
      notify.warning("请输入场景名称")
      return
    }

    if (!description.trim()) {
      notify.warning("请输入场景提示词")
      return
    }

    const modelId = selectedModel || availableModels[0]?.id
    if (!modelId) {
      notify.warning("暂无可用生图模型")
      return
    }

    if (!projectId) {
      notify.warning("缺少项目信息，无法生成")
      return
    }

    revealTaskPanel()
    void startGeneration({
      kind: "scene",
      projectId: Number(projectId),
      assetId: initialData?.id,
      name: sceneName.trim(),
      prompt: description.trim(),
      model: modelId,
      size: "1536x1024",
      extras: {
        description: description.trim(),
        distance: distance[0],
        zoom,
      },
    }).then((result) => {
      if (result === "ok") {
        notify.success(initialData ? "场景已重新生成并保存" : "场景已生成并加入素材库")
      }
    }).catch((error) => {
      refetch()
      notify.error(error instanceof Error ? error.message : "生成失败")
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[900px] sm:max-w-[900px] p-0 overflow-hidden bg-[hsl(var(--surface))]" style={{ maxWidth: '900px' }} hideCloseButton>
        {/* 隐藏的标题用于无障碍访问 */}
        <SheetTitle className="sr-only">{initialData ? "编辑场景" : "创建场景"}</SheetTitle>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface))]">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-5 h-5" />
            </Button>
            <h2 className="text-xl font-bold text-[hsl(var(--on-surface))]">
              {initialData ? "编辑场景" : "创建场景"}
            </h2>
          </div>
          <GenerationTaskListButton
            label="场景生成任务列表"
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
            {/* Scene Name */}
            <div className="space-y-2">
              <Input 
                placeholder="请输入场景名称"
                value={sceneName}
                onChange={(e) => setSceneName(e.target.value)}
                className="bg-[hsl(var(--surface-container-low))] border-none rounded-xl h-12 text-lg"
              />
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                  <label className="text-sm font-medium text-[hsl(var(--on-surface))]">
                    <span className="text-red-500 mr-1">*</span>选择模型
                  </label>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="h-12 w-full justify-between rounded-xl bg-[hsl(var(--surface-container-low))] px-4 text-left text-sm font-normal text-[hsl(var(--on-surface))] hover:bg-[hsl(var(--surface-container-high))]"
                      >
                        <span>
                          {modelsLoading && imageModels.length === 0
                            ? "加载中..."
                            : (availableModels.find((model) => model.id === selectedModel)?.name ?? "选择场景模型")
                          }
                        </span>
                        <ChevronDown className="h-4 w-4 text-[hsl(var(--secondary))]" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      sideOffset={10}
                      className="w-[var(--radix-dropdown-menu-trigger-width)] rounded-xl border-[hsl(var(--outline-variant))]/30 bg-[hsl(var(--surface-container-lowest))] p-2 shadow-xl"
                    >
                      {modelsLoading && imageModels.length === 0 ? (
                        <DropdownMenuItem disabled className="text-[hsl(var(--secondary))]">
                          加载模型列表...
                        </DropdownMenuItem>
                      ) : (
                        availableModels.map((model) => (
                          <DropdownMenuItem
                            key={model.id}
                            onClick={() => setSelectedModel(model.id)}
                            className={`min-h-[44px] rounded-lg px-3 text-base ${
                              selectedModel === model.id
                                ? "bg-[hsl(var(--primary))] text-white focus:bg-[hsl(var(--primary))] focus:text-white"
                                : "text-[hsl(var(--on-surface))]"
                            }`}
                          >
                            <Check
                              className={`mr-3 h-4 w-4 ${
                                selectedModel === model.id ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            <span>{model.name}</span>
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <p className="text-xs text-[hsl(var(--secondary))]">
                    {availableModels.find((model) => model.id === selectedModel)?.description}
                    {modelsError ? `（模型列表加载失败：${modelsError}，可先用默认模型生成）` : ""}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1 text-[hsl(var(--on-surface))]">
                    <span className="text-red-500">*</span> 提示词
                    <HelpCircle className="w-4 h-4 text-[hsl(var(--secondary))]" />
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="输入文字，描述你想生成的场景，包括空间构成、时间氛围、光线、材质、镜头语言等。"
                    className="min-h-[110px] w-full resize-none rounded-2xl border border-[hsl(var(--outline-variant))]/35 bg-[hsl(var(--surface-container-low))] p-4 text-base text-[hsl(var(--on-surface))] placeholder:text-[hsl(var(--secondary))] focus:outline-none"
                  />
                  <p className="text-xs text-[hsl(var(--secondary))]">
                    详细的描述可帮助场景在构图、氛围和材质上更贴近目标方向。
                  </p>
                </div>
              </div>
          </div>

          {panelOpen ? (
            <GenerationTaskPanel tasks={tasks} highlight={highlightTasks} panelRef={taskPanelRef} />
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
