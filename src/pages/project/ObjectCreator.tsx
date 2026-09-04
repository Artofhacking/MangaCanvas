import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { X, LayoutList, CheckCircle2, Clock } from "lucide-react"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { ImageGenerationForm, type ImageGenerationConfig } from "@/components/forms/ImageGenerationForm"
import type { ObjectItem } from "@/types"

export interface ObjectCreateData {
  name: string
  genMethod: "model" | "upload"
  model?: string
  prompt?: string
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3"
  quantity?: number
  referenceImage?: string
  referenceImages?: string[]
}

export interface ObjectEditData extends ObjectCreateData {
  id: number
}

const objectGenerationTasks = [
  { id: 1, name: "光子武士刀", status: "processing", detail: "正在生成多角度预览", time: "刚刚" },
  { id: 2, name: "古董怀表", status: "completed", detail: "主图和透明底图已完成", time: "12 分钟前" },
  { id: 3, name: "战术背包", status: "queued", detail: "等待队列中，还需约 3 分钟", time: "18 分钟前" },
]

interface ObjectCreatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate?: (data: ObjectCreateData) => void
  onUpdate?: (data: ObjectEditData) => void
  initialData?: ObjectItem | null
  mode?: 'create' | 'edit'
}

export default function ObjectCreator({ 
  open, 
  onOpenChange, 
  onCreate, 
  onUpdate, 
  initialData, 
  mode = 'create' 
}: ObjectCreatorProps) {
  const { notify } = useFeedback()
  const isEditMode = mode === 'edit' && initialData != null
  const [objectName, setObjectName] = useState("")
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false)

  // AI 生成配置
  const [generationConfig, setGenerationConfig] = useState<ImageGenerationConfig>({
    model: "",
    prompt: "",
    aspectRatio: "1:1",
    quantity: 1,
    referenceImages: [],
  })



  const handleSubmit = () => {
    if (!objectName.trim()) {
      notify.warning("请输入物品名称")
      return
    }

    if (!generationConfig.prompt.trim()) {
      notify.warning("请输入物品描述")
      return
    }

    if (isEditMode && initialData) {
      const updatedObject: ObjectEditData = {
        id: initialData.id,
        name: objectName,
        genMethod: "model",
        model: generationConfig.model,
        prompt: generationConfig.prompt.trim(),
        aspectRatio: generationConfig.aspectRatio,
        quantity: generationConfig.quantity,
        referenceImage: generationConfig.referenceImages[0] || undefined,
        referenceImages: generationConfig.referenceImages.length ? generationConfig.referenceImages : undefined,
      }
      onUpdate?.(updatedObject)
      notify.success(`物品 "${updatedObject.name}" 已更新`)
    } else {
      const newObject: ObjectCreateData = {
        name: objectName,
        genMethod: "model",
        model: generationConfig.model,
        prompt: generationConfig.prompt.trim(),
        aspectRatio: generationConfig.aspectRatio,
        quantity: generationConfig.quantity,
        referenceImage: generationConfig.referenceImages[0] || undefined,
        referenceImages: generationConfig.referenceImages.length ? generationConfig.referenceImages : undefined,
      }
      onCreate?.(newObject)
      notify.success(`物品 "${newObject.name}" 创建成功`)
    }
    
    resetForm()
    onOpenChange(false)
  }

  const resetForm = () => {
    setObjectName("")
    setGenerationConfig({
      model: "",
      prompt: "",
      aspectRatio: "1:1",
      quantity: 1,
      referenceImages: [],
    })
    setTaskDrawerOpen(false)
  }

  // 编辑模式下回填数据
  useEffect(() => {
    if (isEditMode && initialData) {
      setObjectName(initialData.name)
      setGenerationConfig(prev => ({
        ...prev,
        prompt: initialData.description || "",
        referenceImages: initialData.image ? [initialData.image] : [],
      }))
    } else if (!open) {
      resetForm()
    }
  }, [isEditMode, initialData, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      <div className="relative h-full w-[600px] shrink-0">
        {taskDrawerOpen && (
          <div className="absolute inset-y-0 right-full h-full w-[360px] border-r border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface-container-lowest))] shadow-2xl animate-in slide-in-from-left duration-300">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-[hsl(var(--outline-variant))]/15 px-5 py-4">
                <div>
                  <h3 className="text-lg font-black text-[hsl(var(--on-surface))]">物品生成任务</h3>
                  <p className="mt-1 text-xs text-[hsl(var(--secondary))]">查看当前创建与上传任务进度</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTaskDrawerOpen(false)}
                  className="h-9 w-9 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-3">
                  {objectGenerationTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`rounded-2xl border p-4 ${
                        task.status === "completed"
                          ? "border-transparent bg-[hsl(var(--surface-container-low))]"
                          : task.status === "processing"
                          ? "border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))]/5"
                          : "border-transparent bg-[hsl(var(--surface-container-low))]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {task.status === "completed" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Clock className={`h-4 w-4 ${task.status === "processing" ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--secondary))]"}`} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-sm font-bold text-[hsl(var(--on-surface))]">{task.name}</p>
                            <span className="shrink-0 text-[10px] text-[hsl(var(--secondary))]">{task.time}</span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-[hsl(var(--on-surface-variant))]">{task.detail}</p>
                          <div className="mt-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                task.status === "completed"
                                  ? "bg-emerald-500/12 text-emerald-600"
                                  : task.status === "processing"
                                  ? "bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))]"
                                  : "bg-[hsl(var(--surface-container-high))] text-[hsl(var(--secondary))]"
                              }`}
                            >
                              {task.status === "completed" ? "已完成" : task.status === "processing" ? "进行中" : "排队中"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Drawer */}
        <div className="relative h-full w-[600px] shrink-0 bg-[hsl(var(--surface))] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--outline-variant))]/20">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-5 h-5" />
            </Button>
            <h2 className="text-xl font-bold text-[hsl(var(--on-surface))]">{isEditMode ? "编辑物品" : "新建物品"}</h2>
          </div>
          <Button 
            variant="ghost"
            onClick={() => setTaskDrawerOpen((current) => !current)}
            className="h-10 rounded-xl border border-[hsl(var(--outline-variant))]/30 bg-[hsl(var(--surface-container-low))] px-4 text-sm font-semibold text-[hsl(var(--on-surface-variant))] hover:bg-[hsl(var(--surface-container-high))]"
          >
            <LayoutList className="h-4 w-4" />
            物品生成任务列表
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Object Name */}
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

          <ImageGenerationForm
            value={generationConfig}
            onChange={setGenerationConfig}
          />
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[hsl(var(--outline-variant))]/20">
          <Button
            onClick={handleSubmit}
            className="w-full py-6 signature-gradient text-white rounded-xl font-bold text-lg border-0 hover:opacity-90 transition-opacity"
          >
            {isEditMode ? "保存修改" : "创建物品"}
          </Button>
        </div>
      </div>
      </div>
    </div>
  )
}
