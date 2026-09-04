import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ImagePlus, Upload, Loader2 } from "lucide-react"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { uploadApi } from "@/api/uploadApi"
import JSZip from "jszip"
import type { CharacterCreateData } from "@/types"

interface CharacterBatchUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: number
  onCreate: (data: CharacterCreateData) => Promise<CharacterCreateData | null | void>
}

function fileNameToCharacterName(filename: string) {
  const basename = filename.split("/").pop() || filename
  return basename.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim() || "未命名角色"
}

const imageMimeTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp", "image/gif"]

export default function CharacterBatchUploadDialog({
  open,
  onOpenChange,
  projectId,
  onCreate,
}: CharacterBatchUploadDialogProps) {
  const { notify } = useFeedback()
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)

  const createCharacterFromFile = async (file: File) => {
    const url = await uploadApi.uploadSingleFile(file, "characters", projectId)
    const name = fileNameToCharacterName(file.name)
    await onCreate({
      name,
      gender: "other",
      ageGroup: "young",
      genMethod: "upload",
      model: "",
      description: "",
      referenceImage: url,
    })
  }

  const processImageFiles = async (files: File[]) => {
    const imageFiles = files.filter((f) => imageMimeTypes.includes(f.type))
    if (imageFiles.length === 0) {
      notify.warning("未检测到支持的图片文件")
      return
    }
    setUploading(true)
    setProgress({ current: 0, total: imageFiles.length })
    let success = 0
    for (let i = 0; i < imageFiles.length; i++) {
      setProgress({ current: i + 1, total: imageFiles.length })
      try {
        await createCharacterFromFile(imageFiles[i])
        success++
      } catch (err) {
        console.error("上传失败:", imageFiles[i].name, err)
      }
    }
    setUploading(false)
    setProgress(null)
    notify.success(`成功创建 ${success} 个角色`)
    onOpenChange(false)
  }

  const processZipFile = async (file: File) => {
    setUploading(true)
    try {
      const zip = await JSZip.loadAsync(file)
      const imageFiles: { name: string; blob: Promise<Blob> }[] = []
      zip.forEach((relativePath, zipEntry) => {
        if (zipEntry.dir) return
        const ext = relativePath.split(".").pop()?.toLowerCase() || ""
        if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
          imageFiles.push({ name: relativePath, blob: zipEntry.async("blob") })
        }
      })

      if (imageFiles.length === 0) {
        notify.warning("压缩包中未找到图片文件")
        setUploading(false)
        return
      }

      setProgress({ current: 0, total: imageFiles.length })
      let success = 0
      for (let i = 0; i < imageFiles.length; i++) {
        setProgress({ current: i + 1, total: imageFiles.length })
        const item = imageFiles[i]
        const blob = await item.blob
        const imageFile = new File([blob], item.name, { type: `image/${item.name.split(".").pop() || "jpeg"}` })
        try {
          await createCharacterFromFile(imageFile)
          success++
        } catch (err) {
          console.error("上传失败:", item.name, err)
        }
      }
      notify.success(`成功创建 ${success} 个角色`)
      onOpenChange(false)
    } catch (err) {
      notify.error("解压压缩包失败")
    } finally {
      setUploading(false)
      setProgress(null)
    }
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    await processImageFiles(Array.from(files))
    e.target.value = ""
  }

  const handleZipSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await processZipFile(file)
    e.target.value = ""
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const zipFile = files.find((f) => f.type === "application/zip" || f.name.endsWith(".zip"))
    if (zipFile) {
      await processZipFile(zipFile)
      return
    }

    await processImageFiles(files)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>批量上传角色</DialogTitle>
        </DialogHeader>

        <div
          className="space-y-4 py-2"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            ref={imageInputRef}
            onChange={handleImageSelect}
            accept="image/jpeg,image/png,image/jpg,image/webp,image/gif"
            multiple
            className="hidden"
          />
          <input
            type="file"
            ref={zipInputRef}
            onChange={handleZipSelect}
            accept=".zip,application/zip"
            className="hidden"
          />

          {uploading ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[hsl(var(--outline-variant))]/40 bg-[hsl(var(--surface-container-low))] p-10">
              <Loader2 className="h-10 w-10 animate-spin text-[hsl(var(--primary))]" />
              <div className="text-center">
                <p className="text-sm font-medium text-[hsl(var(--on-surface))]">
                  正在上传并创建角色…
                </p>
                {progress && (
                  <p className="text-xs text-[hsl(var(--secondary))] mt-1">
                    {progress.current} / {progress.total}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              <div
                onClick={() => imageInputRef.current?.click()}
                className={`cursor-pointer rounded-2xl border border-dashed p-6 transition-colors ${
                  isDragOver
                    ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10"
                    : "border-[hsl(var(--outline-variant))]/40 bg-[hsl(var(--surface-container-low))] hover:bg-[hsl(var(--surface-container-high))]"
                }`}
              >
                <div className="flex flex-col items-center justify-center gap-3 text-center">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                    isDragOver ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]" : "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                  }`}>
                    <ImagePlus className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[hsl(var(--on-surface))]">拖入图片或点击上传</p>
                    <p className="text-xs text-[hsl(var(--secondary))]">支持 JPG / PNG / WEBP / GIF，多张图片将批量创建为角色</p>
                  </div>
                </div>
              </div>

              <div
                onClick={() => zipInputRef.current?.click()}
                className={`cursor-pointer rounded-2xl border border-dashed p-6 transition-colors ${
                  isDragOver
                    ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10"
                    : "border-[hsl(var(--outline-variant))]/40 bg-[hsl(var(--surface-container-low))] hover:bg-[hsl(var(--surface-container-high))]"
                }`}
              >
                <div className="flex flex-col items-center justify-center gap-3 text-center">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                    isDragOver ? "bg-[hsl(var(--secondary-container))] text-[hsl(var(--on-secondary-container))]" : "bg-[hsl(var(--secondary-container))] text-[hsl(var(--on-secondary-container))]"
                  }`}>
                    <Upload className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[hsl(var(--on-surface))]">拖入压缩包或点击上传</p>
                    <p className="text-xs text-[hsl(var(--secondary))]">支持 zip 格式，包内图片将批量创建为角色</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {!uploading && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
