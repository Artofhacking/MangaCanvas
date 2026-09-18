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
import type { Episode } from "@/types"

export interface EpisodeEditData {
  id: number
  folderName: string
  episodeCount: string
  description: string
}

interface EpisodeCreatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate?: (data: {
    folderName: string
    episodeCount: string
    description: string
  }) => void
  onUpdate?: (data: EpisodeEditData) => void
  onOpenCanvas?: () => void
  initialData?: Episode | null
  mode?: "create" | "edit"
  projectId?: number | null
}

export default function EpisodeCreator({
  open,
  onOpenChange,
  onCreate,
  onUpdate,
  onOpenCanvas,
  initialData,
}: EpisodeCreatorProps) {
  const { notify } = useFeedback()
  const [folderName, setFolderName] = useState("")
  const [episodeCount, setEpisodeCount] = useState("")
  const [description, setDescription] = useState("")

  useEffect(() => {
    if (!open) return
    if (initialData) {
      setFolderName(initialData.name)
      setEpisodeCount(String(initialData.count ?? ""))
      setDescription(initialData.description || "")
    } else {
      setFolderName("")
      setEpisodeCount("")
      setDescription("")
    }
  }, [initialData, open])

  const handleSave = () => {
    if (!folderName.trim()) {
      notify.warning("请输入片段名称")
      return
    }
    if (initialData) {
      onUpdate?.({
        id: initialData.id,
        folderName: folderName.trim(),
        episodeCount,
        description,
      })
      notify.success("片段已保存")
      return
    }
    onCreate?.({
      folderName: folderName.trim(),
      episodeCount,
      description,
    })
    notify.success("片段已创建")
    onOpenChange(false)
  }

  const handleOpenCanvas = () => {
    if (initialData) {
      onUpdate?.({
        id: initialData.id,
        folderName: folderName.trim() || initialData.name,
        episodeCount,
        description,
      })
    }
    onOpenChange(false)
    onOpenCanvas?.()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[480px] sm:max-w-[480px] p-0 overflow-hidden bg-[hsl(var(--surface))]"
        style={{ maxWidth: "480px" }}
        hideCloseButton
      >
        <SheetTitle className="sr-only">{initialData ? "编辑片段" : "创建片段"}</SheetTitle>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--outline-variant))]/20">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-5 h-5" />
            </Button>
            <h2 className="text-xl font-bold text-[hsl(var(--on-surface))]">{initialData ? "编辑片段" : "创建片段"}</h2>
          </div>
        </div>

        <div className="h-[calc(100vh-150px)] space-y-5 overflow-y-auto px-6 py-5">
          <div className="rounded-2xl bg-[hsl(var(--primary))]/8 p-4">
            <p className="text-sm font-bold text-[hsl(var(--on-surface))]">片段成片走无限画布</p>
            <p className="mt-1 text-xs leading-5 text-[hsl(var(--secondary))]">
              这里只保存名称和剧情。要把已生成的角色、场景、物品串进这一集并出视频，请进入无限画布编排。
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[hsl(var(--on-surface))]">
              <span className="text-red-500 mr-1">*</span>片段名称
            </label>
            <Input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="请输入片段名称"
              className="h-11 rounded-xl bg-[hsl(var(--surface-container-low))] border-none text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[hsl(var(--on-surface))]">集数 / 时长</label>
            <Input
              value={episodeCount}
              onChange={(e) => setEpisodeCount(e.target.value)}
              placeholder="可选"
              className="h-11 rounded-xl bg-[hsl(var(--surface-container-low))] border-none text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[hsl(var(--on-surface))]">本集剧情</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="本集场次、动作和关键对白。进入无限画布后会作为剧情提示带入。"
              className="min-h-[180px] w-full resize-none rounded-2xl border border-[hsl(var(--outline-variant))]/35 bg-[hsl(var(--surface-container-low))] p-4 text-sm text-[hsl(var(--on-surface))] placeholder:text-[hsl(var(--secondary))] focus:outline-none"
            />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 flex gap-3 p-4 bg-gradient-to-t from-[hsl(var(--surface))] to-transparent">
          {initialData ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleSave}
                className="h-12 flex-1 rounded-xl border-[hsl(var(--outline-variant))] bg-[hsl(var(--surface-container-low))] text-base font-bold"
              >
                保存
              </Button>
              <Button
                type="button"
                onClick={handleOpenCanvas}
                className="h-12 flex-1 signature-gradient rounded-xl border-0 text-base font-bold text-white"
              >
                进入无限画布
              </Button>
            </>
          ) : (
            <Button
              type="button"
              onClick={handleSave}
              className="w-full h-12 signature-gradient rounded-xl border-0 text-base font-bold text-white"
            >
              创建片段
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
