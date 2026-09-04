import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, Trash2, Copy, Check, ArrowRight, Wand2, Workflow, Pencil } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { useProjectStore } from "@/store/projectStore"
import type { Scene } from "@/types"
import { useState } from "react"
import SceneCreator from "../SceneCreator"

interface ScenesTabProps {
  projectId?: number | null
  scenes?: Scene[]
  onAddNew?: () => void
  onOpenCanvas?: () => void
  batchMode?: boolean
  selectedIds?: number[]
  onToggleSelect?: (id: number) => void
}

export default function ScenesTab({
  projectId,
  scenes: scenesProp,
  onAddNew,
  onOpenCanvas,
  batchMode = false,
  selectedIds = [],
  onToggleSelect,
}: ScenesTabProps) {
  const scenes = useProjectStore((state) => scenesProp ?? state.assets.scenes)
  const { deleteScene, duplicateScene, updateScene } = useProjectStore()
  const { confirm, notify } = useFeedback()
  
  const [editScene, setEditScene] = useState<Scene | null>(null)
  const [creatorOpen, setCreatorOpen] = useState(false)

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: "删除场景",
      description: "删除后将无法恢复这个场景及其当前信息。",
      confirmText: "删除",
      tone: "danger",
    })

    if (confirmed) {
      if (!projectId) return
      await deleteScene(projectId, id)
      notify.success("场景已删除")
    }
  }

  const handleDuplicate = (scene: Scene) => {
    if (!projectId) return
    void duplicateScene(projectId, scene.id)
  }

  const handleAddNew = () => {
    if (onAddNew) {
      onAddNew()
    } else {
      setEditScene(null)
      setCreatorOpen(true)
    }
  }

  const handleEdit = (scene: Scene) => {
    setEditScene(scene)
    setCreatorOpen(true)
  }

  const handleUpdate = async (data: { id: number; name: string; genMethod: string; model: string; description: string; distance: number; zoom: number; status: "draft" | "in-use" }) => {
    if (!projectId) return
    await updateScene(projectId, data.id, data)
    setCreatorOpen(false)
    setEditScene(null)
  }

  const handleOpenCanvas = () => {
    if (onOpenCanvas) {
      onOpenCanvas()
      return
    }

    notify.info("无限画布创作模式正在接入场景工作流")
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
      {/* Add New Scene Card */}
      <div
        className="aspect-[4/3] rounded-xl border-2 border-dashed border-[hsl(var(--outline-variant))] bg-[linear-gradient(180deg,hsl(var(--surface-container))_0%,hsl(var(--surface-container-low))_100%)] p-4 transition-all hover:border-[hsl(var(--primary))]/35 hover:shadow-lg hover:shadow-[hsl(var(--primary))]/5"
      >
        <div className="mb-4 pt-1">
          <h3 className="text-base font-bold text-[hsl(var(--on-surface))]">添加场景</h3>
          <p className="mt-1 text-xs leading-5 text-[hsl(var(--secondary))]">
            选择创作方式。
          </p>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleAddNew}
            className="flex w-full items-center justify-between rounded-xl bg-[hsl(var(--surface-container-high))] px-3 py-3 text-left transition-all hover:bg-[hsl(var(--surface-container-highest))]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))]">
                <Wand2 className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-[hsl(var(--on-surface))]">快捷创作</div>
                <div className="text-[10px] text-[hsl(var(--secondary))]">快速建场景</div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-[hsl(var(--secondary))]" />
          </button>

          <button
            type="button"
            onClick={handleOpenCanvas}
            className="flex w-full items-center justify-between rounded-xl border border-[hsl(var(--outline-variant))]/60 bg-[hsl(var(--surface))]/75 px-3 py-3 text-left transition-all hover:border-[hsl(var(--primary))]/30 hover:bg-[hsl(var(--surface-container-lowest))]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--secondary-container))] text-[hsl(var(--on-secondary-container))]">
                <Workflow className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-[hsl(var(--on-surface))]">无限画布</div>
                <div className="text-[10px] text-[hsl(var(--secondary))]">自由编排</div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-[hsl(var(--secondary))]" />
          </button>
        </div>
      </div>

      {/* Scene Cards */}
      {scenes.map((scene) => (
        <div 
          key={scene.id}
          onClick={batchMode ? () => onToggleSelect?.(scene.id) : undefined}
          className={`group relative rounded-xl overflow-hidden bg-[hsl(var(--surface-container-lowest))] transition-all hover:shadow-xl hover:shadow-[hsl(var(--on-surface))]/5 hover:-translate-y-1 ${batchMode ? "cursor-pointer ring-2 ring-transparent" : ""} ${selectedIds.includes(scene.id) ? "ring-[hsl(var(--primary))]" : ""}`}
        >
          <div className="aspect-[4/3] w-full relative overflow-hidden">
            <img 
              src={scene.image} 
              alt={scene.name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            />
            <div className="absolute top-3 left-3 flex gap-2">
              <Badge 
                className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase border-0 ${
                  scene.status === "in-use" 
                    ? "bg-[hsl(var(--primary))] text-white" 
                    : "bg-[hsl(var(--surface-container-highest))] text-[hsl(var(--on-secondary-fixed-variant))]"
                }`}
              >
                {scene.status === "in-use" ? "使用中" : "草稿"}
              </Badge>
            </div>
            {batchMode && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onToggleSelect?.(scene.id)
                }}
                className={`absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border ${selectedIds.includes(scene.id) ? "border-transparent bg-[hsl(var(--primary))] text-white" : "border-white/60 bg-black/30 text-transparent"}`}
              >
                <Check className="h-4 w-4" />
              </button>
            )}
            <div className={`absolute inset-0 bg-gradient-to-t from-[hsl(var(--on-surface))]/60 to-transparent transition-opacity flex items-end p-4 ${batchMode ? "opacity-0 pointer-events-none" : "opacity-0 group-hover:opacity-100"}`}>
              <div className="flex gap-2 w-full">
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => handleEdit(scene)}
                  className="flex-1 bg-white/20 backdrop-blur-md text-white text-[10px] font-bold py-2 rounded-lg border border-white/30 hover:bg-white/40 transition-colors"
                >
                  {scene.status === "in-use" ? "编辑详情" : "继续工作"}
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
                    <DropdownMenuItem onClick={() => handleEdit(scene)}>
                      <Pencil className="w-4 h-4 mr-2" />
                      编辑
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicate(scene)}>
                      <Copy className="w-4 h-4 mr-2" />
                      复制
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDelete(scene.id)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
          <div className="p-4">
            <h3 className="text-sm font-extrabold text-[hsl(var(--on-surface))] mb-1">{scene.name}</h3>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[hsl(var(--secondary))] font-medium">修改于 {scene.modified}</span>
              <Badge variant="secondary" className="text-[10px] bg-[hsl(var(--secondary-container))] text-[hsl(var(--on-secondary-container))] px-2 py-0.5 rounded-full font-bold border-0">
                {scene.code}
              </Badge>
            </div>
          </div>
        </div>
      ))}

      {/* Scene Creator / Editor */}
      <SceneCreator
        open={creatorOpen}
        onOpenChange={setCreatorOpen}
        onUpdate={handleUpdate}
        initialData={editScene}
        mode={editScene ? 'edit' : 'create'}
      />
    </div>
  )
}
