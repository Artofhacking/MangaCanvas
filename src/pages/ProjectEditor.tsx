import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Check, ImagePlus, Layers3, Save, Sparkles, X } from "lucide-react"

export interface EditableProject {
  id: number
  name: string
  description?: string
  image: string
  status: "in-progress" | "completed" | "draft"
  modified: string
  code: string
  assetCount: number
}

interface ProjectEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: EditableProject | null
  onSave: (project: EditableProject) => void
}

const projectStatuses = [
  { id: "draft", label: "草稿" },
  { id: "in-progress", label: "进行中" },
  { id: "completed", label: "已完成" },
] as const

const builtInCovers = [
  "https://images.unsplash.com/photo-1614726365723-49cfae927846?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1542640244-7e672d6cef4e?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1615840287214-7ff58936c4cf?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&h=400&fit=crop",
] as const

export default function ProjectEditor({ open, onOpenChange, project, onSave }: ProjectEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [image, setImage] = useState("")
  const [status, setStatus] = useState<EditableProject["status"]>("draft")

  useEffect(() => {
    if (!project) return

    setName(project.name)
    setDescription(project.description ?? "")
    setImage(project.image)
    setStatus(project.status)
  }, [project])

  const handleCoverUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !file.type.startsWith("image/")) return

    const previewUrl = URL.createObjectURL(file)
    setImage(previewUrl)
  }

  const handleSave = () => {
    if (!project || !name.trim()) return

    onSave({
      ...project,
      name: name.trim(),
      description: description.trim(),
      image,
      status,
      modified: "刚刚",
    })
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[560px] sm:max-w-[560px] overflow-hidden border-l border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface))] p-0"
        hideCloseButton
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-[hsl(var(--outline-variant))]/20 px-6 py-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="h-5 w-5" />
              </Button>
              <div>
                <h2 className="text-xl font-bold text-[hsl(var(--on-surface))]">编辑项目</h2>
                <p className="text-xs text-[hsl(var(--secondary))]">调整卡片展示信息与基础状态</p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6 pb-28">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[hsl(var(--on-surface))]">项目封面</label>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-9 rounded-xl border border-[hsl(var(--outline-variant))]/30 bg-[hsl(var(--surface-container-low))] px-3 text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-high))]"
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  更换封面
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                className="hidden"
              />
              <div className="overflow-hidden rounded-2xl border border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface-container-low))] p-4">
                <div className="aspect-[16/9] w-full max-w-[320px] overflow-hidden rounded-2xl">
                  <img src={image} alt={name || "项目封面"} className="h-full w-full object-cover" />
                </div>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-[hsl(var(--secondary))]">
                    <Sparkles className="h-4 w-4" />
                    系统内置封面
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {builtInCovers.map((cover) => {
                      const isActive = image === cover

                      return (
                        <button
                          key={cover}
                          type="button"
                          onClick={() => setImage(cover)}
                          className={`group relative overflow-hidden rounded-xl border transition-all ${
                            isActive
                              ? "border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--primary))]/20"
                              : "border-[hsl(var(--outline-variant))]/20 hover:border-[hsl(var(--primary))]/40"
                          }`}
                        >
                          <div className="aspect-[4/3] w-full overflow-hidden bg-[hsl(var(--surface))]">
                            <img src={cover} alt="系统内置封面" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                          </div>
                          {isActive ? (
                            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-white">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-2xl bg-[hsl(var(--surface-container-low))] p-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[hsl(var(--on-surface))]">
                  <span className="mr-1 text-red-500">*</span>项目名称
                </label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="请输入项目名称"
                  className="h-11 rounded-xl border-none bg-[hsl(var(--surface))] text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[hsl(var(--on-surface))]">项目简介</label>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="补充项目的风格方向、目标或说明"
                  className="min-h-[120px] rounded-xl border-none bg-[hsl(var(--surface))] text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[hsl(var(--on-surface))]">项目状态</label>
                <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[hsl(var(--surface))] p-1.5">
                  {projectStatuses.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setStatus(item.id)}
                      className={`rounded-xl px-3 py-3 text-sm font-medium transition-all ${
                        status === item.id
                          ? "signature-gradient text-white shadow-sm"
                          : "text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-high))] hover:text-[hsl(var(--on-surface))]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4">
              <div className="rounded-2xl bg-[hsl(var(--surface-container-low))] p-4">
                <p className="flex items-center gap-2 text-xs text-[hsl(var(--secondary))]">
                  <Layers3 className="h-4 w-4" />
                  资源数量
                </p>
                <p className="mt-2 text-lg font-bold text-[hsl(var(--on-surface))]">{project?.assetCount ?? 0} 个</p>
              </div>
            </section>
          </div>

          <div className="absolute bottom-0 left-0 right-0 border-t border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface))] px-6 py-4">
            <Button onClick={handleSave} className="signature-gradient h-12 w-full rounded-xl text-white">
              <Save className="mr-2 h-4 w-4" />
              保存项目信息
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
