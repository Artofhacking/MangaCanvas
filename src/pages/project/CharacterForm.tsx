import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, Loader2 } from "lucide-react"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { ImageGenerationForm, type ImageGenerationConfig } from "@/components/forms/ImageGenerationForm"
import { generateAssetImage } from "@/lib/generateAssetImage"
import type { CharacterCreateData, CharacterEditData, Character } from "@/types"

const genderOptions = [
  { value: "male", label: "男" },
  { value: "female", label: "女" },
  { value: "other", label: "其他" },
]

const ageOptions = [
  { value: "child", label: "儿童" },
  { value: "teen", label: "少年" },
  { value: "young", label: "青年" },
  { value: "middle", label: "中年" },
  { value: "old", label: "老年" },
]

export type CharacterFormValues = {
  name: string
  gender: string
  ageGroup: string
  style: string
  model: string
  prompt: string
  aspectRatio: ImageGenerationConfig["aspectRatio"]
  referenceImages: string[]
}

interface CharacterFormProps {
  mode?: 'create' | 'edit'
  initialData?: Character | null
  onSubmit?: (data: CharacterCreateData | CharacterEditData, action: "save" | "generate") => void
  onCancel?: () => void
  hideActions?: boolean
  onValuesChange?: (values: CharacterFormValues) => void
}

export default function CharacterForm({
  mode = 'create',
  initialData,
  onSubmit,
  onCancel,
  hideActions = false,
  onValuesChange,
}: CharacterFormProps) {
  const { notify } = useFeedback()
  const isEditMode = mode === 'edit' && initialData != null
  const [gender, setGender] = useState("")
  const [age, setAge] = useState("")
  const [characterName, setCharacterName] = useState("")
  const [style, setStyle] = useState("")

  const [generationConfig, setGenerationConfig] = useState<ImageGenerationConfig>({
    model: "",
    prompt: "",
    aspectRatio: "1:1",
    quantity: 1,
    referenceImages: [],
  })
  const initializedRef = useRef(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    if (isEditMode && initialData) {
      setCharacterName(initialData.name)
      setGender(initialData.gender || "")
      setAge(initialData.ageGroup || "")
      setStyle(initialData.style || "")
      setGenerationConfig({
        model: initialData.model || "",
        prompt: initialData.description || "",
        aspectRatio: initialData.aspectRatio || "1:1",
        quantity: 1,
        referenceImages: initialData.image ? [initialData.image] : [],
      })
    } else {
      resetForm()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.id, mode])

  useEffect(() => {
    onValuesChange?.({
      name: characterName,
      gender,
      ageGroup: age,
      style,
      model: generationConfig.model,
      prompt: generationConfig.prompt,
      aspectRatio: generationConfig.aspectRatio,
      referenceImages: generationConfig.referenceImages,
    })
  }, [age, characterName, gender, generationConfig, onValuesChange, style])

  const resetForm = () => {
    setCharacterName("")
    setGender("")
    setAge("")
    setStyle("")
    setGenerationConfig({
      model: "",
      prompt: "",
      aspectRatio: "1:1",
      quantity: 1,
      referenceImages: [],
    })
  }

  const buildPayload = (referenceImage?: string): CharacterCreateData | CharacterEditData => {
    const payload: CharacterCreateData = {
      name: characterName.trim(),
      gender,
      ageGroup: age,
      genMethod: "model",
      model: generationConfig.model,
      style,
      description: generationConfig.prompt,
      referenceImage,
      quantity: generationConfig.quantity,
    }
    if (isEditMode && initialData) {
      return { ...payload, id: initialData.id }
    }
    return payload
  }

  const handleSave = () => {
    if (!characterName.trim()) {
      notify.warning("请输入角色名称")
      return
    }
    if (!gender) {
      notify.warning("请选择性别")
      return
    }
    if (!age) {
      notify.warning("请选择年龄段")
      return
    }
    onSubmit?.(buildPayload(), "save")
  }

  const handleGenerate = async () => {
    if (!characterName.trim()) {
      notify.warning("请输入角色名称")
      return
    }
    if (!gender) {
      notify.warning("请选择性别")
      return
    }
    if (!age) {
      notify.warning("请选择年龄段")
      return
    }
    if (!generationConfig.prompt.trim()) {
      notify.warning("请输入角色描述")
      return
    }
    if (!generationConfig.model) {
      notify.warning("暂无可用生图模型")
      return
    }

    setSubmitting(true)
    try {
      const imageUrl = await generateAssetImage({
        model: generationConfig.model,
        prompt: generationConfig.prompt.trim(),
        aspectRatio: generationConfig.aspectRatio,
        referenceImages: generationConfig.referenceImages,
        n: 1,
      })
      setGenerationConfig((current) => ({ ...current, referenceImages: [imageUrl] }))
      onSubmit?.(buildPayload(imageUrl), "generate")
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "生成失败")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-[hsl(var(--on-surface))]">
            <span className="text-red-500 mr-1">*</span>角色名称
          </label>
          <Input
            value={characterName}
            onChange={(e) => setCharacterName(e.target.value)}
            placeholder="请输入"
            className="h-11 rounded-xl bg-[hsl(var(--surface-container-low))] border-none text-sm placeholder:text-[hsl(var(--secondary))] focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[hsl(var(--on-surface))]">
            <span className="text-red-500 mr-1">*</span>性别
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full h-11 justify-between rounded-xl bg-[hsl(var(--surface-container-low))] hover:bg-[hsl(var(--surface-container-high))] text-sm font-normal px-3"
              >
                <span className={gender ? "text-[hsl(var(--on-surface))]" : "text-[hsl(var(--secondary))]"}>
                  {gender ? genderOptions.find(g => g.value === gender)?.label : "请选择"}
                </span>
                <ChevronDown className="w-4 h-4 text-[hsl(var(--secondary))]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              {genderOptions.map((option) => (
                <DropdownMenuItem key={option.value} onClick={() => setGender(option.value)}>
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[hsl(var(--on-surface))]">
            <span className="text-red-500 mr-1">*</span>年龄段
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full h-11 justify-between rounded-xl bg-[hsl(var(--surface-container-low))] hover:bg-[hsl(var(--surface-container-high))] text-sm font-normal px-3"
              >
                <span className={age ? "text-[hsl(var(--on-surface))]" : "text-[hsl(var(--secondary))]"}>
                  {age ? ageOptions.find(a => a.value === age)?.label : "请选择"}
                </span>
                <ChevronDown className="w-4 h-4 text-[hsl(var(--secondary))]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              {ageOptions.map((option) => (
                <DropdownMenuItem key={option.value} onClick={() => setAge(option.value)}>
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[hsl(var(--on-surface))]">风格</label>
          <Input
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            placeholder="如：赛博朋克、水墨风"
            className="h-11 rounded-xl bg-[hsl(var(--surface-container-low))] border-none text-sm placeholder:text-[hsl(var(--secondary))] focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))]"
          />
        </div>
      </div>

      <ImageGenerationForm
        value={generationConfig}
        onChange={setGenerationConfig}
        quantityOptions={[1, 2, 3, 4, 5]}
        directory="characters"
      />

      {hideActions ? null : <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            取消
          </Button>
        )}
        {isEditMode ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={handleSave}
              disabled={submitting}
              className="h-12 min-w-[120px] rounded-xl border-[hsl(var(--outline-variant))] bg-[hsl(var(--surface-container-low))] text-base font-bold text-[hsl(var(--on-surface))] hover:bg-[hsl(var(--surface-container-high))]"
            >
              保存
            </Button>
            <Button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={submitting}
              className="h-12 min-w-[120px] px-8 signature-gradient text-white rounded-xl font-bold text-base border-0 disabled:opacity-60"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  生成中...
                </span>
              ) : (
                "生成"
              )}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={submitting}
            className="h-12 min-w-[120px] px-8 signature-gradient text-white rounded-xl font-bold text-base border-0 disabled:opacity-60"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                生成中...
              </span>
            ) : (
              "生成"
            )}
          </Button>
        )}
      </div>}
    </div>
  )
}
