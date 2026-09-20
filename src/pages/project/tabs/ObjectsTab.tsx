import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Check, Trash2, MoreHorizontal, MapPin, Clock, Settings } from "lucide-react"
import { useFeedback } from "@/components/feedback/FeedbackProvider"

import { useProjectStore } from "@/store/projectStore"
import type { CanvasLaunchSource, ObjectItem, ObjectType } from "@/types"
import { useState } from "react"
import ObjectCreator from "../ObjectCreator"
import AssetDetailDialog, { AssetDetailBadge } from "./AssetDetailDialog"
import AssetQuickCreateCard from "./AssetQuickCreateCard"

interface ObjectsTabProps {
  projectId?: number | null
  objects?: ObjectItem[]
  onAddNew?: () => void
  onUpload?: () => void
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
  onUpload,
  onOpenCanvas,
  batchMode = false,
  selectedIds = [],
  onToggleSelect,
}: ObjectsTabProps) {
  const objects = useProjectStore((state) => objectsProp ?? state.assets.objects)
  const { updateObject, deleteObject } = useProjectStore()
  const { confirm, notify } = useFeedback()
  
  const [editObject, setEditObject] = useState<ObjectItem | null>(null)
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [selectedObject, setSelectedObject] = useState<ObjectItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

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

  const handleUpdate = async (data: { id: number; name: string; genMethod: "model" | "upload"; model?: string; prompt?: string; aspectRatio?: string; referenceImage?: string; referenceImages?: string[] }) => {
    if (!projectId) return
    await updateObject(projectId, data.id, {
      name: data.name,
      description: data.prompt,
      aspectRatio: data.aspectRatio,
      ...(data.referenceImage ? { image: data.referenceImage } : {}),
    })
    notify.success(data.referenceImage ? "物品已生成并加入素材库" : "物品已保存")
  }

  const handleOpenCanvas = (source?: CanvasLaunchSource) => {
    if (onOpenCanvas) {
      onOpenCanvas(source)
      return
    }

    notify.info("无限画布创作模式正在接入物品工作流")
  }

  const handleCardClick = (object: ObjectItem) => {
    if (batchMode) {
      onToggleSelect?.(object.id)
      return
    }
    setSelectedObject(object)
    setDetailOpen(true)
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 3xl:grid-cols-10 gap-4">
      <AssetQuickCreateCard
        variant="object"
        title="添加物品"
        description="选择创作方式"
        quickHint="快速建物品"
        onQuickCreate={handleAddNew}
        onUpload={onUpload}
        onOpenCanvas={() => handleOpenCanvas()}
      />

      {/* Object Cards */}
      {objects.map((object) => (
        <div 
          key={object.id}
          onClick={() => handleCardClick(object)}
          className={`group relative rounded-xl overflow-hidden bg-[hsl(var(--surface-container-lowest))] transition-all hover:shadow-xl hover:shadow-[hsl(var(--on-surface))]/5 hover:-translate-y-1 cursor-pointer ${batchMode ? "ring-2 ring-transparent" : ""} ${selectedIds.includes(object.id) ? "ring-[hsl(var(--primary))]" : ""}`}
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
                    onClick={(event) => {
                      event.stopPropagation()
                      handleOpenCanvas({
                        id: object.id,
                        name: object.name,
                        image: object.image,
                        description: object.description,
                      })
                    }}
                    className="flex-1 bg-white/20 backdrop-blur-md text-white text-[10px] font-bold py-2 rounded-lg border border-white/30 hover:bg-white/40 transition-colors"
                  >
                    打开画布
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleEdit(object)
                    }}
                    className="flex-1 bg-white/20 backdrop-blur-md text-white text-[10px] font-bold py-2 rounded-lg border border-white/30 hover:bg-white/40 transition-colors"
                  >
                    {object.hasImage ? "编辑" : "生成"}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={(event) => event.stopPropagation()}
                        className="w-10 bg-white/20 backdrop-blur-md text-white py-2 rounded-lg border border-white/30 hover:bg-white/40 transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        onClick={(event) => {
                          event.stopPropagation()
                          void handleDelete(object.id)
                        }}
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

      <AssetDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        image={selectedObject?.image}
        name={selectedObject?.name ?? ""}
        badge={
          selectedObject ? (
            <span className="flex items-center gap-1.5">
              <AssetDetailBadge className={`${typeColors[selectedObject.type]} text-white`}>
                {selectedObject.type}
              </AssetDetailBadge>
              {selectedObject.status === "in-use" ? (
                <AssetDetailBadge className="bg-[hsl(var(--primary))] text-white">使用中</AssetDetailBadge>
              ) : null}
            </span>
          ) : undefined
        }
        metas={
          selectedObject
            ? [
                {
                  icon: <MapPin className="w-4 h-4" />,
                  label: "关联场景",
                  value: selectedObject.scene,
                },
                {
                  icon: <Clock className="w-4 h-4" />,
                  label: "最近修改",
                  value: selectedObject.modified,
                },
                ...(selectedObject.model
                  ? [
                      {
                        icon: <Settings className="w-4 h-4" />,
                        label: "生成模型",
                        value: selectedObject.model,
                      },
                    ]
                  : []),
              ]
            : []
        }
        aspectRatio={selectedObject?.aspectRatio}
        prompt={selectedObject?.description}
        assetId={selectedObject?.id}
        onOpenCanvas={
          selectedObject
            ? () =>
                handleOpenCanvas({
                  id: selectedObject.id,
                  name: selectedObject.name,
                  image: selectedObject.image,
                  description: selectedObject.description,
                })
            : undefined
        }
      />

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
