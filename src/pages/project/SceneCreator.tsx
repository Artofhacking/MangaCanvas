import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import { HelpCircle, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import ShapingPanel from "@/features/project/ShapingPanel"
import { normalizeShapingStatus } from "@/features/project/shaping"
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

export interface SceneEditData extends SceneCreateData {
  id: number
}

interface SceneCreatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate?: (data: SceneEditData) => void
  initialData?: Scene | null
  onSetPromptLock?: (locked: boolean) => Promise<void>
  lockingPrompt?: boolean
}

export default function SceneCreator({
  open,
  onOpenChange,
  onUpdate,
  initialData,
  onSetPromptLock,
  lockingPrompt = false,
}: SceneCreatorProps) {
  const { notify } = useFeedback()
  const [sceneName, setSceneName] = useState("")
  const [description, setDescription] = useState("")
  const initializedRef = useRef(false)
  const prevOpenRef = useRef(open)
  const shapingStatus = normalizeShapingStatus(initialData?.shapingStatus)
  const promptLocked = shapingStatus !== "unset"

  useEffect(() => {
    const isOpening = open && !prevOpenRef.current
    prevOpenRef.current = open

    if (!open) {
      initializedRef.current = false
      return
    }
    if (!isOpening || initializedRef.current) return
    initializedRef.current = true

    if (initialData) {
      setSceneName(initialData.name)
      setDescription(initialData.description || "")
    } else {
      setSceneName("")
      setDescription("")
    }
  }, [initialData, open])

  const handleSave = () => {
    if (!sceneName.trim()) {
      notify.warning("请输入场景名称")
      return
    }
    if (!initialData) return

    onUpdate?.({
      id: initialData.id,
      name: sceneName.trim(),
      genMethod: "upload",
      model: initialData.model || "",
      description,
      distance: 8,
      zoom: 0.6,
      status: initialData.status === "in-use" ? "in-use" : "draft",
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[900px] sm:max-w-[900px] p-0 overflow-hidden bg-[hsl(var(--surface))]" style={{ maxWidth: "900px" }} hideCloseButton>
        <SheetTitle className="sr-only">编辑场景</SheetTitle>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface))]">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-5 h-5" />
            </Button>
            <h2 className="text-xl font-bold text-[hsl(var(--on-surface))]">编辑场景</h2>
          </div>
        </div>

        <div className="flex h-[calc(100vh-70px)] flex-col space-y-6 overflow-y-auto p-6 pb-28">
          {initialData ? (
            <>
              <Input
                placeholder="请输入场景名称"
                value={sceneName}
                onChange={(e) => setSceneName(e.target.value)}
                className="bg-[hsl(var(--surface-container-low))] border-none rounded-xl h-12 text-lg"
              />
              <ShapingPanel
                status={shapingStatus}
                prompt={initialData.description}
                busy={lockingPrompt}
                onLock={onSetPromptLock ? () => void onSetPromptLock(true) : undefined}
                onUnlock={onSetPromptLock ? () => void onSetPromptLock(false) : undefined}
              />
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1 text-[hsl(var(--on-surface))]">
                  提示词
                  <HelpCircle className="w-4 h-4 text-[hsl(var(--secondary))]" />
                  {promptLocked ? (
                    <span className="text-xs font-normal text-[hsl(var(--secondary))]">已锁定，改之前请先解锁</span>
                  ) : null}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={promptLocked}
                  placeholder="空间、时间、光线和材质。出图请到无限画布。"
                  className="min-h-[140px] w-full resize-none rounded-2xl border border-[hsl(var(--outline-variant))]/35 bg-[hsl(var(--surface-container-low))] px-4 py-4 text-base text-[hsl(var(--on-surface))] placeholder:text-[hsl(var(--secondary))] focus:outline-none disabled:opacity-50"
                />
              </div>
            </>
          ) : (
            <p className="text-sm leading-6 text-[hsl(var(--secondary))]">
              新场景请上传入库，或到无限画布生成后保存到素材库。
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
