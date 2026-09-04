import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FileText } from "lucide-react"

interface ProjectCreatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate?: (project: {
    name: string
    password?: string
    mode: string
    description: string
  scriptFile?: File | null
  }) => void
}

export default function ProjectCreator({ open, onOpenChange, onCreate }: ProjectCreatorProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [coverImage, setCoverImage] = useState<File | null>(null)

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      return
    }
    setCoverImage(file)
  }

  const handleSubmit = () => {
    if (!name.trim()) return
    onCreate?.({
      name: name.trim(),
      mode: "manual",
      description,
      scriptFile: null,
    })
    // reset
    setName("")
    setDescription("")
    setCoverImage(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[520px] p-0 overflow-hidden border-0 rounded-2xl bg-[hsl(var(--surface))]">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-2 text-left">
          <DialogTitle className="text-xl font-bold text-[hsl(var(--on-surface))]">
            新建项目
          </DialogTitle>
        </DialogHeader>

        {/* Form */}
        <div className="px-6 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* 项目名称 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[hsl(var(--on-surface))]">
              <span className="text-red-500 mr-1">*</span>项目名称
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入项目名称"
              className="h-11 rounded-xl bg-[hsl(var(--surface-container-low))] border-none text-sm placeholder:text-[hsl(var(--secondary))] focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))]"
            />
          </div>

          {/* 项目说明 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[hsl(var(--on-surface))]">项目说明</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请填写项目说明"
              rows={4}
              className="rounded-xl bg-[hsl(var(--surface-container-low))] border-none text-sm placeholder:text-[hsl(var(--secondary))] resize-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))]"
            />
            <div className="text-right text-xs text-[hsl(var(--secondary))]">{description.length}</div>
          </div>

          {/* 上传项目封面图 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[hsl(var(--on-surface))]">上传项目封面图，最佳尺寸3:4</label>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverChange}
                className="hidden"
                id="cover-upload"
              />
              <label
                htmlFor="cover-upload"
                className="h-36 bg-[hsl(var(--surface-container-low))] rounded-xl border-2 border-dashed border-[hsl(var(--outline-variant))]/50 flex flex-col items-center justify-center gap-2 hover:bg-[hsl(var(--surface-container-high))] transition-colors cursor-pointer group overflow-hidden"
              >
                {coverImage ? (
                  <>
                    <FileText className="w-10 h-10 text-[hsl(var(--primary))]" />
                    <span className="text-sm text-[hsl(var(--on-surface))] font-medium">{coverImage.name}</span>
                    <span className="text-xs text-[hsl(var(--secondary))]">点击重新上传封面图</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-10 h-10 text-[hsl(var(--primary))] group-hover:scale-110 transition-transform"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
                      <path d="M8 12l2.5 2.5L14 11l4 4" />
                      <circle cx="9" cy="10" r="1.5" />
                    </svg>
                    <span className="text-xs text-[hsl(var(--secondary))]">点击上传封面图</span>
                  </>
                )}
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2">
          <Button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="w-full h-11 signature-gradient text-white rounded-xl font-bold text-base border-0 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            创建项目
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
