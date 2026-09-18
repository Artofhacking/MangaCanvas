import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Check, Wand2, Workflow, Trash2, Copy, MoreHorizontal } from "lucide-react"
import { useFeedback } from "@/components/feedback/FeedbackProvider"

import { useProjectStore } from "@/store/projectStore"
import type { CanvasLaunchSource, ObjectItem, ObjectType } from "@/types"
import { useState } from "react"
import ObjectCreator from "../ObjectCreator"

interface ObjectsTabProps {
  projectId?: number | null
  objects?: ObjectItem[]
  onAddNew?: () => void
  onOpenCanvas?: (source?: CanvasLaunchSource) => void
  batchMode?: boolean
  selectedIds?: number[]
  onToggleSelect?: (id: number) => void
}

const typeColors: Record<ObjectType, string> = {
  "武器": "bg-red-500",
  "道具": "bg-blue-500",
  "服装": "bg-purple-500",
  "场景装饰": "bg-emerald-500",
  "AI生成": "bg-orange-500",
  "上传": "bg-cyan-500",
}

export default function ObjectsTab({
  projectId,
  objects: objectsProp,
  onAddNew,
  onOpenCanvas,
  batchMode = false,
  selectedIds = [],
  onToggleSelect,
}: ObjectsTabProps) {
  const objects = useProjectStore((state) => objectsProp ?? state.assets.objects)
  const { updateObject, deleteObject, duplicateObject } = useProjectStore()
  const { confirm, notify } = useFeedback()
  
  const [editObject, setEditObject] = useState<ObjectItem | null>(null)
  const [creatorOpen, setCreatorOpen] = useState(false)

  const handleAddNew = () => {
    if (onAddNew) {
      onAddNew()
    } else {
      setEditObject(null)
      setCreatorOpen(true)
    }
  }

  const handleEdit = (object: ObjectItem) => {
    setEditObject(object)
    setCreatorOpen(true)
  }

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: "删除物品",
      description: "删除后将无法恢复这个物品。",
      confirmText: "删除",
      tone: "danger",
    })
    if (confirmed) {
      if (!projectId) return
      await deleteObject(projectId, id)
      notify.success("物品已删除")
    }
  }

  const handleDuplicate = async (object: ObjectItem) => {
    if (!projectId) return
    await duplicateObject(projectId, object.id)
    notify.success("物品已复制")
  }

  const handleUpdate = async (data: { id: number; name: string; genMethod: "model" | "upload"; model?: string; prompt?: string; aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3"; referenceImage?: string; referenceImages?: string[] }) => {
    if (!projectId) return
    await updateObject(projectId, data.id, {
      name: data.name,
      description: data.prompt,
      ...(data.referenceImage ? { image: data.referenceImage } : {}),
    })
    notify.success(data.referenceImage ? "物品已生成" : "物品已保存")
  }

  const handleOpenCanvas = (source?: CanvasLaunchSource) => {
    if (onOpenCanvas) {
      onOpenCanvas(source)
      return
    }

    notify.info("无限画布创作模式正在接入物品工作流")
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 3xl:grid-cols-10 gap-4">
      {/* Add New Object Card */}
      <div
        className="aspect-square rounded-xl border-2 border-dashed border-[hsl(var(--outline-variant))] bg-[linear-gradient(180deg,hsl(var(--surface-container))_0%,hsl(var(--surface-container-low))_100%)] p-3 transition-all hover:border-[hsl(var(--primary))]/35 hover:shadow-lg hover:shadow-[hsl(var(--primary))]/5"
      >
        <div className="mb-3">
          <h3 className="text-sm font-bold text-[hsl(var(--on-surface))]">添加物品</h3>
          <p className="mt-1 text-[10px] text-[hsl(var(--secondary))]">
            选择创作方式
          </p>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleAddNew}
            className="flex w-full items-center gap-2 rounded-xl bg-[hsl(var(--surface-container-high))] px-2 py-2 text-left transition-all hover:bg-[hsl(var(--surface-container-highest))]"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))]">
              <Wand2 className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="cn-nowrap text-xs font-bold text-[hsl(var(--on-surface))]">快捷创作</div>
              <div className="cn-nowrap text-[13px] text-[hsl(var(--secondary))]">快速建物品</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleOpenCanvas()}
            className="flex w-full items-center gap-2 rounded-xl border border-[hsl(var(--outline-variant))]/60 bg-[hsl(var(--surface))]/75 px-2 py-2 text-left transition-all hover:border-[hsl(var(--primary))]/30 hover:bg-[hsl(var(--surface-container-lowest))]"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--secondary-container))] text-[hsl(var(--on-secondary-container))]">
              <Workflow className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="cn-nowrap text-xs font-bold text-[hsl(var(--on-surface))]">无限画布</div>
              <div className="cn-nowrap text-[13px] text-[hsl(var(--secondary))]">自由编排</div>
            </div>
          </button>
        </div>
      </div>

      {/* Object Cards */}
      {objects.map((object) => (
        <div 
          key={object.id}
          onClick={batchMode ? () => onToggleSelect?.(object.id) : undefined}
          className={`group relative rounded-xl overflow-hidden bg-[hsl(var(--surface-container-lowest))] transition-all hover:shadow-xl hover:shadow-[hsl(var(--on-surface))]/5 hover:-translate-y-1 ${batchMode ? "cursor-pointer ring-2 ring-transparent" : ""} ${selectedIds.includes(object.id) ? "ring-[hsl(var(--primary))]" : ""}`}
        >
          <div className="aspect-square w-full relative overflow-hidden">
            <img 
              src={object.image} 
              alt={object.name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
            <div className="absolute top-3 left-3 flex gap-1">
              <Badge 
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border-0 ${typeColors[object.type]} text-white`}
              >
                {object.type}
              </Badge>
              {object.status === "in-use" && (
                <Badge className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border-0 bg-[hsl(var(--primary))] text-white">
                  使用中
                </Badge>
              )}
            </div>
            {batchMode ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onToggleSelect?.(object.id)
                }}
                className={`absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border ${selectedIds.includes(object.id) ? "border-transparent bg-[hsl(var(--primary))] text-white" : "border-white/60 bg-black/30 text-transparent"}`}
              >
                <Check className="h-4 w-4" />
              </button>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--on-surface))]/60 to-transparent transition-opacity flex items-end p-3 opacity-0 group-hover:opacity-100">
                <div className="flex gap-1.5 w-full">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      handleOpenCanvas({
                        id: object.id,
                        name: object.name,
                        image: object.image,
                        description: object.description,
                      })
                    }
                    className="flex-1 bg-white/20 backdrop-blur-md text-white text-[10px] font-bold py-2 rounded-lg border border-white/30 hover:bg-white/40 transition-colors"
                  >
                    打开画布
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleEdit(object)}
                    className="flex-1 bg-white/20 backdrop-blur-md text-white text-[10px] font-bold py-2 rounded-lg border border-white/30 hover:bg-white/40 transition-colors"
                  >
                    {object.hasImage ? "编辑" : "生成"}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="w-10 bg-white/20 backdrop-blur-md text-white py-2 rounded-lg border border-white/30 hover:bg-white/40 transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => void handleDuplicate(object)}>
                        <Copy className="w-4 h-4 mr-2" />
                        复制
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => void handleDelete(object.id)}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )}

          </div>
          <div className="p-3">
            <h3 className="cn-keep text-sm font-bold text-[hsl(var(--on-surface))] mb-1 truncate">{object.name}</h3>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[hsl(var(--secondary))] truncate max-w-[60%]">{object.scene}</span>
              <span className="text-[13px] text-[hsl(var(--secondary))]">{object.modified}</span>
            </div>
          </div>
        </div>
      ))}

      {/* Object Creator / Editor */}
      <ObjectCreator
        open={creatorOpen}
        onOpenChange={setCreatorOpen}
        onUpdate={handleUpdate}
        initialData={editObject}
        mode={editObject ? 'edit' : 'create'}
        projectId={projectId}
      />
    </div>
  )
}
