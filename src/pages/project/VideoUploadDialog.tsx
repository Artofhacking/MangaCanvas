import { useEffect, useRef, useState } from "react"
import { Upload } from "lucide-react"

import { uploadApi } from "@/api/uploadApi"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { fileNameToAssetName } from "@/pages/project/assetBatchUpload"
import { useProjectStore } from "@/store/projectStore"

const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm,.m4v"

interface VideoUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId?: number | null
}

export default function VideoUploadDialog({ open, onOpenChange, projectId }: VideoUploadDialogProps) {
  const { notify } = useFeedback()
  const createVideo = useProjectStore((state) => state.createVideo)
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState("")
  const [prompt, setPrompt] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setFile(null)
    setName("")
    setPrompt("")
    setSubmitting(false)
  }, [open])

  const handleFile = (next: File | null) => {
    setFile(next)
    if (next && !name.trim()) {
      setName(fileNameToAssetName(next.name, "未命名视频"))
    }
  }

  const handleSubmit = async () => {
    if (!projectId) {
      notify.error("当前项目信息缺失")
      return
    }
    if (!file) {
      notify.info("请先选择视频文件")
      return
    }
    if (!name.trim()) {
      notify.info("请填写视频名称")
      return
    }
    if (file.type && !file.type.startsWith("video/")) {
      notify.error("请上传视频文件")
      return
    }

    setSubmitting(true)
    try {
      const url = await uploadApi.uploadSingleFile(file, "assets")
      const created = await createVideo(projectId, {
        name: name.trim(),
        url,
        prompt: prompt.trim() || undefined,
      })
      if (!created) {
        throw new Error(useProjectStore.getState().error || "视频未能写入视频库")
      }
      notify.success("视频已加入视频库")
      onOpenChange(false)
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "上传视频失败")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[480px] p-0 overflow-hidden border-0 rounded-2xl bg-[hsl(var(--surface))]">
        <DialogHeader className="px-6 pt-6 pb-2 text-left">
          <DialogTitle className="text-xl font-bold text-[hsl(var(--on-surface))]">上传视频</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium text-[hsl(var(--on-surface))]">视频文件</p>
            <input
              ref={fileRef}
              type="file"
              accept={VIDEO_ACCEPT}
              className="hidden"
              onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center gap-3 rounded-xl bg-[hsl(var(--surface-container-low))] px-4 py-3 text-left text-sm text-[hsl(var(--on-surface))]"
            >
              <Upload className="h-4 w-4 text-[hsl(var(--primary))]" />
              <span className="truncate">{file ? file.name : "选择 mp4、webm 或 mov"}</span>
            </button>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[hsl(var(--on-surface))]" htmlFor="video-upload-name">
              名称
            </label>
            <Input
              id="video-upload-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="视频名称"
              className="h-11 rounded-xl border-none bg-[hsl(var(--surface-container-low))]"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[hsl(var(--on-surface))]" htmlFor="video-upload-prompt">
              提示词
            </label>
            <Textarea
              id="video-upload-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="可选，方便之后回看这段视频是怎么来的"
              className="min-h-[96px] rounded-xl border-none bg-[hsl(var(--surface-container-low))]"
            />
          </div>
        </div>

        <div className="px-6 pb-6 pt-2">
          <Button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmit()}
            className="h-11 w-full rounded-xl border-0 text-base font-bold text-white signature-gradient"
          >
            {submitting ? "正在上传..." : "加入视频库"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
