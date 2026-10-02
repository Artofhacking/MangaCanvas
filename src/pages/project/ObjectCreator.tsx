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
import ShapingPanel from "@/features/project/ShapingPanel"
import { normalizeShapingStatus } from "@/features/project/shaping"
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
  onUpdate?: (data: ObjectEditData) => void
  initialData?: ObjectItem | null
  onSetPromptLock?: (locked: boolean) => Promise<void>
  lockingPrompt?: boolean
}

export default function ObjectCreator({
  open,
  onOpenChange,
  onUpdate,
  initialData,
  onSetPromptLock,
  lockingPrompt = false,
}: ObjectCreatorProps) {
  const { notify } = useFeedback()
  const [objectName, setObjectName] = useState("")
  const [prompt, setPrompt] = useState("")
  const shapingStatus = normalizeShapingStatus(initialData?.shapingStatus)
  const promptLocked = shapingStatus !== "unset"

  useEffect(() => {
    if (!open) return
    if (initialData) {
      setObjectName(initialData.name)
      setPrompt(initialData.description || "")
    } else {
      setObjectName("")
      setPrompt("")
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
      genMethod: "upload",
      model: initialData.model,
      prompt: prompt.trim(),
      aspectRatio: initialData.aspectRatio,
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[900px] sm:max-w-[900px] p-0 overflow-hidden bg-[hsl(var(--surface))]" style={{ maxWidth: "900px" }} hideCloseButton>
        <SheetTitle className="sr-only">编辑物品</SheetTitle>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface))]">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-5 h-5" />
            </Button>
            <h2 className="text-xl font-bold text-[hsl(var(--on-surface))]">编辑物品</h2>
          </div>
        </div>

        <div className="flex h-[calc(100vh-70px)] flex-col space-y-6 overflow-y-auto p-6 pb-28">
          {initialData ? (
            <>
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
              <ShapingPanel
                status={shapingStatus}
                prompt={initialData.description}
                busy={lockingPrompt}
                onLock={onSetPromptLock ? () => void onSetPromptLock(true) : undefined}
                onUnlock={onSetPromptLock ? () => void onSetPromptLock(false) : undefined}
              />
              <div className="space-y-2">
                <label className="text-sm font-medium text-[hsl(var(--on-surface))]">
                  提示词
                  {promptLocked ? (
                    <span className="ml-2 text-xs font-normal text-[hsl(var(--secondary))]">已锁定，改之前请先解锁</span>
                  ) : null}
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={promptLocked}
                  placeholder="外形、材质和用途。出图请到无限画布。"
                  className="min-h-[140px] w-full resize-none rounded-2xl border border-[hsl(var(--outline-variant))]/35 bg-[hsl(var(--surface-container-low))] px-4 py-4 text-base text-[hsl(var(--on-surface))] placeholder:text-[hsl(var(--secondary))] focus:outline-none disabled:opacity-50"
                />
              </div>
            </>
          ) : (
            <p className="text-sm leading-6 text-[hsl(var(--secondary))]">
              新物品请上传入库，或到无限画布生成后保存到素材库。
            </p>
          )}
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
