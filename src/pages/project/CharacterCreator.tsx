import { useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import { X } from "lucide-react"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import type { Character, CharacterEditData } from "@/types"
import ShapingPanel from "@/features/project/ShapingPanel"
import { normalizeShapingStatus } from "@/features/project/shaping"
import CharacterForm, { type CharacterFormValues } from "./CharacterForm"

interface CharacterCreatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate?: (data: CharacterEditData) => void
  initialData?: Character | null
  onSetPromptLock?: (locked: boolean) => Promise<void>
  lockingPrompt?: boolean
}

export default function CharacterCreator({
  open,
  onOpenChange,
  onUpdate,
  initialData,
  onSetPromptLock,
  lockingPrompt = false,
}: CharacterCreatorProps) {
  const { notify } = useFeedback()
  const valuesRef = useRef<CharacterFormValues | null>(null)
  const shapingStatus = normalizeShapingStatus(initialData?.shapingStatus)
  const promptLocked = shapingStatus !== "unset"

  const handleValuesChange = useCallback((values: CharacterFormValues) => {
    valuesRef.current = values
  }, [])

  const handleSave = () => {
    const values = valuesRef.current
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
      genMethod: initialData.genMethod || "upload",
      model: initialData.model || "",
      style: values.style,
      description: values.prompt,
      aspectRatio: initialData.aspectRatio,
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[900px] sm:max-w-[900px] p-0 overflow-hidden bg-[hsl(var(--surface))]" style={{ maxWidth: "900px" }} hideCloseButton>
        <SheetTitle className="sr-only">编辑角色</SheetTitle>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface))]">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-5 h-5" />
            </Button>
            <h2 className="text-xl font-bold text-[hsl(var(--on-surface))]">编辑角色</h2>
          </div>
        </div>

        <div className="flex h-[calc(100vh-70px)] flex-col overflow-y-auto p-6 pb-28">
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
          ) : (
            <p className="text-sm leading-6 text-[hsl(var(--secondary))]">
              新角色请上传入库，或到无限画布生成后保存到素材库。
            </p>
          )}
          {initialData ? (
            <CharacterForm
              key={initialData.id}
              initialData={initialData}
              promptLocked={promptLocked}
              onValuesChange={handleValuesChange}
            />
          ) : null}
        </div>

        {initialData ? (
          <div className="absolute bottom-0 left-0 w-full space-y-2 p-4 bg-gradient-to-t from-[hsl(var(--surface))] to-transparent">
            <Button
              type="button"
              onClick={handleSave}
              className="h-12 w-full signature-gradient rounded-xl border-0 text-base font-bold text-white"
            >
              保存
            </Button>
            <p className="text-center text-xs text-[hsl(var(--secondary))]">
              出图请到无限画布，完成后保存到素材库。
            </p>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
