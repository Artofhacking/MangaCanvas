import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
  Loader2,
  Image as ImageIcon,
} from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { useImageModels, useImageGeneration } from "@/features/infinite-canvas/hooks"
import type { Scene } from "@/types"

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

type SceneGenTask = {
  id: string
  name: string
  prompt: string
  status: "running" | "succeeded" | "failed"
  progress: string
  imageUrl?: string
  error?: string
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
  mode?: 'create' | 'edit'
}

export default function SceneCreator({ 
  open, 
  onOpenChange, 
  onCreate, 
  onUpdate, 
  initialData, 
  mode = 'create' 
}: SceneCreatorProps) {
  const { notify } = useFeedback()
  const isEditMode = mode === 'edit' && initialData != null
  const { models: imageModels, loading: modelsLoading, error: modelsError, refetch } = useImageModels()
  const { generate } = useImageGeneration()
  const [selectedModel, setSelectedModel] = useState<string>("gpt-image-2")
  const [tasks, setTasks] = useState<SceneGenTask[]>([])
  const [submitting, setSubmitting] = useState(false)

  const [distance, setDistance] = useState([8.0])
  const [zoom, setZoom] = useState(0.6)
  const [sceneName, setSceneName] = useState("")
  const [description, setDescription] = useState("")
  // 用于防止 useEffect 重复执行的 ref
  const initializedRef = useRef(false)
  const prevOpenRef = useRef(open)

  // 重置表单的函数
  const resetForm = () => {
    setSceneName("")
    setDescription("")
    setSelectedModel(imageModels.find((model) => model.id === "gpt-image-2")?.id || imageModels[0]?.id || "gpt-image-2")
    setDistance([8.0])
    setZoom(0.6)
    setTasks([])
    setSubmitting(false)
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
    
    if (isEditMode && initialData) {
      setSceneName(initialData.name)
      setSelectedModel(initialData.model || imageModels[0]?.id || "")
      setDescription(initialData.description || "")
    } else {
      resetForm()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleSubmit = async () => {
    if (!sceneName.trim()) {
      notify.warning("请输入场景名称")
      return
    }

    if (isEditMode && initialData) {
      const updatedScene: SceneEditData = {
        id: initialData.id,
        name: sceneName,
        genMethod: "model",
        model: selectedModel,
        description,
        distance: distance[0],
        zoom,
        status: initialData.status === "in-use" ? "in-use" : "draft",
      }
      onUpdate?.(updatedScene)
      notify.success("场景已更新")
      onOpenChange(false)
      return
    }

    if (!description.trim()) {
      notify.warning("请输入场景提示词")
      return
    }

    const taskId = `scene_${Date.now()}`
    const task: SceneGenTask = {
      id: taskId,
      name: sceneName.trim(),
      prompt: description.trim(),
      status: "running",
      progress: "准备中...",
    }
    setTasks((current) => [task, ...current])
    setSubmitting(true)

    try {
      const urls = await generate(
        {
          model: selectedModel || "gpt-image-2",
          prompt: description.trim(),
          size: "1536x1024",
          quality: "medium",
          n: 1,
        },
        (status) => {
          setTasks((current) =>
            current.map((item) => (item.id === taskId ? { ...item, progress: status } : item))
          )
        }
      )
      const imageUrl = urls?.[0]
      if (!imageUrl) {
        throw new Error("未返回生成结果")
      }

      setTasks((current) =>
        current.map((item) =>
          item.id === taskId
            ? { ...item, status: "succeeded", progress: "生成完成", imageUrl }
            : item
        )
      )
      onCreate?.({
        name: sceneName.trim(),
        genMethod: "model",
        model: selectedModel || "gpt-image-2",
        description: description.trim(),
        distance: distance[0],
        zoom,
        status: "draft",
        referenceImage: imageUrl,
      })
      notify.success("场景已生成")
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "生成失败"
      setTasks((current) =>
        current.map((item) =>
          item.id === taskId
            ? { ...item, status: "failed", progress: "生成失败", error: messageText }
            : item
        )
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[900px] sm:max-w-[900px] p-0 overflow-hidden bg-[hsl(var(--surface))]" style={{ maxWidth: '900px' }} hideCloseButton>
        {/* 隐藏的标题用于无障碍访问 */}
        <SheetTitle className="sr-only">创建场景</SheetTitle>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface))]">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-5 h-5" />
            </Button>
            <h2 className="text-xl font-bold text-[hsl(var(--on-surface))]">{isEditMode ? "编辑场景" : "创建场景"}</h2>
          </div>
          <Badge className="signature-gradient text-white border-0 px-4 py-1.5">
            场景生成任务列表
          </Badge>
        </div>

        <div className="flex h-[calc(100vh-70px)]">
          <div className="flex h-full w-[52%] flex-col space-y-6 overflow-y-auto border-r border-[hsl(var(--outline-variant))]/15 p-6 pb-24">
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
                          {modelsLoading 
                            ? "加载中..." 
                            : (imageModels.find((model) => model.id === selectedModel)?.name ?? "选择场景模型")
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
                      {modelsLoading ? (
                        <DropdownMenuItem disabled className="text-[hsl(var(--secondary))]">
                          加载模型列表...
                        </DropdownMenuItem>
                      ) : modelsError ? (
                        <DropdownMenuItem 
                          onClick={() => refetch()} 
                          className="text-red-500 cursor-pointer"
                        >
                          加载失败: {modelsError} (点击重试)
                        </DropdownMenuItem>
                      ) : imageModels.length === 0 ? (
                        <DropdownMenuItem disabled className="text-[hsl(var(--secondary))]">
                          暂无可用模型
                        </DropdownMenuItem>
                      ) : (
                        imageModels.map((model) => (
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
                    {imageModels.find((model) => model.id === selectedModel)?.description}
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

          <div className="flex h-full min-w-0 flex-1 flex-col bg-[hsl(var(--surface-container-low))]/40">
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
                    <div className="aspect-[3/2] bg-[hsl(var(--surface-container-low))]">
                      {task.imageUrl ? (
                        <img src={task.imageUrl} alt={task.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-3 text-[hsl(var(--secondary))]">
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
        </div>

        <div className="absolute bottom-0 left-0 w-[52%] p-4 bg-gradient-to-t from-[hsl(var(--surface))] to-transparent">
          <Button 
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="w-full py-6 signature-gradient text-white rounded-xl font-bold text-lg border-0 disabled:opacity-60"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                生成中...
              </span>
            ) : isEditMode ? "保存修改" : "提交任务"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
