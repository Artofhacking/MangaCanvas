import { useRef, useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { X, ImagePlus, Check, ChevronDown, Loader2 } from "lucide-react"
import { useMultiUpload } from "@/hooks/useUpload"
import type { UploadDirectory } from "@/api/uploadApi"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { useImageModels } from "@/features/infinite-canvas/hooks/useModels"
import { cn } from "@/lib/utils"

export interface ImageGenerationConfig {
  model: string
  prompt: string
  aspectRatio: "1:1" | "16:9" | "9:16" | "4:3"
  quantity: number
  referenceImages: string[]
}

interface ImageGenerationFormProps {
  value: ImageGenerationConfig
  onChange: (value: ImageGenerationConfig) => void
  models?: { id: string; name: string; desc: string }[]
  quantityOptions?: number[]
  showQuantity?: boolean
  disabled?: boolean
  directory?: UploadDirectory
}

// 模型数据从 API 获取，此处保留作为极端情况下的 fallback
const fallbackModels = [
  { id: "jimeng-3", name: "即梦 3.0", desc: "中文语义强，适合概念物品" },
  { id: "keling-3", name: "可灵 3.0", desc: "质感稳定，适合商品表达" },
  { id: "mj-v7", name: "Midjourney V7", desc: "风格化强，适合创意设计" },
  { id: "sdxl", name: "SDXL", desc: "通用型底模，便于快速出图" },
]

const aspectRatioValues = ["1:1", "16:9", "9:16", "4:3"] as const

function PromptChromePills<T extends string | number>({
  label,
  options,
  value,
  disabled,
  onChange,
  format,
  title,
}: {
  label: string
  options: T[]
  value: T
  disabled?: boolean
  onChange: (next: T) => void
  format?: (option: T) => string
  title?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      title={title}
      className="flex items-center gap-0.5 rounded-full bg-[hsl(var(--surface-container-lowest))] p-0.5"
    >
      {options.map((option) => {
        const active = option === value
        return (
          <button
            key={String(option)}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={cn(
              "h-8 min-w-[2.25rem] whitespace-nowrap rounded-full px-3 text-xs font-semibold tracking-tight transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))] disabled:opacity-50",
              active
                ? "signature-gradient text-white shadow-sm"
                : "text-[hsl(var(--on-surface-variant))] hover:bg-[hsl(var(--surface-container-high))]"
            )}
          >
            {format ? format(option) : String(option)}
          </button>
        )
      })}
    </div>
  )
}

export function ImageGenerationForm({
  value,
  onChange,
  models: propModels,
  quantityOptions = [1, 2, 3, 4],
  showQuantity = true,
  disabled = false,
  directory = "objects",
}: ImageGenerationFormProps) {
  const { notify } = useFeedback()
  const [isReferenceDragOver, setIsReferenceDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 从 API 获取图片模型列表
  const { models: apiModels, loading: modelsLoading, error: modelsError } = useImageModels()

  // 将 API 模型转换为组件需要的格式
  const models = useMemo(() => {
    // 如果外部传入了 models，优先使用
    if (propModels) return propModels
    // 如果 API 返回了数据，使用 API 数据
    if (apiModels.length > 0) {
      return apiModels.map(m => ({
        id: m.id,
        name: m.name,
        desc: m.description || "",
      }))
    }
    // 否则使用 fallback
    return fallbackModels
  }, [propModels, apiModels])

  // 如果当前选中的模型不在列表中，自动切换到第一个可用模型
  useEffect(() => {
    if (models.length > 0 && !models.find(m => m.id === value.model)) {
      onChange({ ...value, model: models[0].id })
    }
  }, [models, value.model, onChange, value])

  const { uploading, uploadMultiple } = useMultiUpload({
    directory,
  })

  const updateField = <K extends keyof ImageGenerationConfig>(
    field: K,
    fieldValue: ImageGenerationConfig[K]
  ) => {
    onChange({ ...value, [field]: fieldValue })
  }

  const handleReferenceImagesUpload = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/")
    )
    if (imageFiles.length === 0) return

    const urls = await uploadMultiple(imageFiles)
    if (urls.length > 0) {
      updateField("referenceImages", [...value.referenceImages, ...urls])
      notify.success(`成功上传 ${urls.length} 张图片`)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    await handleReferenceImagesUpload(files)
    e.target.value = ""
  }

  const handleReferenceDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsReferenceDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      await handleReferenceImagesUpload(e.dataTransfer.files)
    }
  }

  const removeReferenceImage = (index: number) => {
    updateField(
      "referenceImages",
      value.referenceImages.filter((_, i) => i !== index)
    )
  }

  const selectedModelInfo = models.find((m) => m.id === value.model)

  return (
    <div className="space-y-6">
      {/* Model Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-[hsl(var(--on-surface))]">
          <span className="mr-1 text-red-500">*</span>选择模型
        </label>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              disabled={disabled || modelsLoading}
              className="h-12 w-full justify-between rounded-xl bg-[hsl(var(--surface-container-low))] px-4 text-left text-sm font-normal text-[hsl(var(--on-surface))] hover:bg-[hsl(var(--surface-container-high))] disabled:opacity-50"
            >
              <span>
                {modelsLoading 
                  ? "加载模型中..." 
                  : selectedModelInfo?.name ?? "选择生成模型"}
              </span>
              {modelsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--secondary))]" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[hsl(var(--secondary))]" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={10}
            className="w-[var(--radix-dropdown-menu-trigger-width)] rounded-xl border-[hsl(var(--outline-variant))]/30 bg-[hsl(var(--surface-container-lowest))] p-2 shadow-xl"
          >
            {models.map((model) => (
              <DropdownMenuItem
                key={model.id}
                onClick={() => updateField("model", model.id)}
                className={`min-h-[44px] rounded-lg px-3 text-base ${
                  value.model === model.id
                    ? "bg-[hsl(var(--primary))] text-white focus:bg-[hsl(var(--primary))] focus:text-white"
                    : "text-[hsl(var(--on-surface))]"
                }`}
              >
                <Check
                  className={`mr-3 h-4 w-4 ${
                    value.model === model.id ? "opacity-100" : "opacity-0"
                  }`}
                />
                <span>{model.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <p className="text-xs text-[hsl(var(--secondary))]">
          {modelsError ? `模型加载失败: ${modelsError}` : selectedModelInfo?.desc}
        </p>
      </div>

      {/* Prompt composer: refs + ratio/qty live in the box chrome */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[hsl(var(--on-surface))]">
          <span className="mr-1 text-red-500">*</span>提示词
        </label>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/jpeg,image/png,image/jpg"
          multiple
          className="hidden"
        />
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsReferenceDragOver(true)
          }}
          onDragLeave={() => setIsReferenceDragOver(false)}
          onDrop={handleReferenceDrop}
          className={cn(
            "rounded-2xl border bg-[hsl(var(--surface-container-low))] transition-all",
            isReferenceDragOver
              ? "border-[hsl(var(--primary))]/60 bg-[hsl(var(--primary))]/5"
              : "border-[hsl(var(--outline-variant))]/35"
          )}
        >
          <textarea
            value={value.prompt}
            onChange={(e) => updateField("prompt", e.target.value)}
            placeholder={
              uploading ? "正在上传..." : "上传参考图、输入文字，描述你想生成的图片。"
            }
            disabled={uploading || disabled}
            className="min-h-[132px] w-full resize-none bg-transparent px-4 pb-2 pt-4 text-base text-[hsl(var(--on-surface))] placeholder:text-[hsl(var(--secondary))] focus:outline-none disabled:opacity-50"
          />

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[hsl(var(--outline-variant))]/20 px-3 py-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {value.referenceImages.map((image, index) => (
                <div
                  key={`${image}-${index}`}
                  className="group relative h-12 w-12 overflow-hidden rounded-xl border border-[hsl(var(--outline-variant))]/25 bg-[hsl(var(--surface-container-lowest))]"
                >
                  <img
                    src={image}
                    alt={`参考图 ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeReferenceImage(index)}
                    disabled={disabled}
                    className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {uploading && (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-dashed border-[hsl(var(--outline-variant))]/40">
                  <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--primary))]" />
                </div>
              )}
              <button
                type="button"
                onClick={() =>
                  !uploading && !disabled && fileInputRef.current?.click()
                }
                disabled={uploading || disabled}
                aria-label="上传参考图"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-[hsl(var(--outline-variant))]/40 text-[hsl(var(--secondary))] transition-all hover:border-[hsl(var(--primary))]/45 hover:text-[hsl(var(--primary))] disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5">
              <PromptChromePills
                label="生成比例"
                options={[...aspectRatioValues]}
                value={value.aspectRatio}
                disabled={disabled}
                onChange={(next) => updateField("aspectRatio", next)}
              />
              {showQuantity ? (
                <>
                  <span
                    className="h-4 w-px bg-[hsl(var(--outline-variant))]/45"
                    aria-hidden
                  />
                  <div className="flex items-center gap-1.5">
                    <PromptChromePills
                      label="生成数量"
                      options={quantityOptions}
                      value={value.quantity}
                      disabled={disabled}
                      onChange={(next) => updateField("quantity", next)}
                      format={(qty) => `${qty}张`}
                      title="每次生成会消耗相应积分"
                    />
                    <span
                      className="text-[10px] leading-none text-[hsl(var(--secondary))]"
                      title="每次生成会消耗相应积分"
                    >
                      耗积分
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
