import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, Trash2, Check, Clock, Hash, Settings } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { useProjectStore } from "@/store/projectStore"
import { useAssetGenerationStore } from "@/store/assetGenerationStore"
import { toCanvasLaunchSource } from "@/lib/workflows"
import type { CanvasLaunchSource, Scene } from "@/types"
import { useState } from "react"
import ShapingPanel, { ShapingBadge } from "@/features/project/ShapingPanel"
import SceneCreator from "../SceneCreator"
import AssetDetailDialog, { AssetDetailBadge } from "./AssetDetailDialog"
import AssetQuickCreateCard from "./AssetQuickCreateCard"

interface ScenesTabProps {
  projectId?: number | null
  scenes?: Scene[]
  onAddNew?: () => void
  onUpload?: () => void
  onOpenCanvas?: (source?: CanvasLaunchSource) => void
  batchMode?: boolean
  selectedIds?: number[]
  onToggleSelect?: (id: number) => void
}

export default function ScenesTab({
  projectId,
  scenes: scenesProp,
  onAddNew,
  onUpload,
  onOpenCanvas,
  batchMode = false,
  selectedIds = [],
  onToggleSelect,
}: ScenesTabProps) {
  const scenes = useProjectStore((state) => scenesProp ?? state.assets.scenes)
  const { deleteScene, updateScene, setScenePromptLock } = useProjectStore()
  const generationTasks = useAssetGenerationStore((state) => state.tasks)
  const { confirm, notify } = useFeedback()
  
  const [editScene, setEditScene] = useState<Scene | null>(null)
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [lockingPrompt, setLockingPrompt] = useState(false)
  const selectedSceneLive = selectedScene
    ? scenes.find((item) => item.id === selectedScene.id) ?? selectedScene
    : null
  const editSceneLive = editScene ? scenes.find((item) => item.id === editScene.id) ?? editScene : null

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

  const isDraftScene = (scene: Scene) => !scene.hasImage && scene.status !== "in-use"

  const sceneTask = (sceneId: number) =>
    generationTasks.find((task) => task.kind === "scene" && task.assetId === sceneId)

  const handleUpdate = async (data: {
    id: number
    name: string
    genMethod: string
    model: string
    description: string
    distance: number
    zoom: number
    status: "draft" | "in-use"
    referenceImage?: string
  }) => {
    if (!projectId) return
    await updateScene(projectId, data.id, {
      name: data.name,
      description: data.description,
      image: data.referenceImage,
      status: data.status,
    })
    notify.success(data.referenceImage ? "场景已生成并加入素材库" : "场景已保存")
  }

  const handleOpenCanvas = (source?: CanvasLaunchSource) => {
    if (onOpenCanvas) {
      onOpenCanvas(source)
      return
    }

    notify.info("无限画布创作模式正在接入场景工作流")
  }

  const handleSetPromptLock = async (scene: Scene, locked: boolean) => {
    if (!projectId) return
    setLockingPrompt(true)
    const updated = await setScenePromptLock(projectId, scene.id, locked)
    setLockingPrompt(false)
    if (!updated) {
      notify.error(useProjectStore.getState().error || (locked ? "锁定提示词失败" : "解锁失败"))
      return
    }
    setSelectedScene(updated)
    setEditScene((current) => (current?.id === updated.id ? updated : current))
    notify.success(locked ? "提示词已锁定" : "已解锁，回到还没定")
  }

  const handleCardClick = (scene: Scene) => {
    if (batchMode) {
      onToggleSelect?.(scene.id)
      return
    }
    setSelectedScene(scene)
    setDetailOpen(true)
  }

  const sceneStatusLabel = (scene: Scene) => {
    if (sceneTask(scene.id)?.status === "running") return "生成中"
    if (scene.hasImage || scene.status === "in-use") return "使用中"
    return "草稿"
  }

  const sceneStatusClass = (scene: Scene) =>
    sceneTask(scene.id)?.status === "running" || scene.hasImage || scene.status === "in-use"
      ? "bg-[hsl(var(--primary))] text-white"
      : "bg-[hsl(var(--surface-container-highest))] text-[hsl(var(--on-secondary-fixed-variant))]"

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
      <AssetQuickCreateCard
        variant="scene"
        title="添加场景"
        description="选择创作方式。"
        quickHint="快速建场景"
        onQuickCreate={handleAddNew}
        onUpload={onUpload}
        onOpenCanvas={() => handleOpenCanvas()}
      />

      {/* Scene Cards */}
      {scenes.map((scene) => (
        <div 
          key={scene.id}
          onClick={() => handleCardClick(scene)}
          className={`group relative rounded-xl overflow-hidden bg-[hsl(var(--surface-container-lowest))] transition-all hover:shadow-xl hover:shadow-[hsl(var(--on-surface))]/5 hover:-translate-y-1 cursor-pointer ${batchMode ? "ring-2 ring-transparent" : ""} ${selectedIds.includes(scene.id) ? "ring-[hsl(var(--primary))]" : ""}`}
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
                  sceneTask(scene.id)?.status === "running" || scene.hasImage || scene.status === "in-use"
                    ? "bg-[hsl(var(--primary))] text-white" 
                    : "bg-[hsl(var(--surface-container-highest))] text-[hsl(var(--on-secondary-fixed-variant))]"
                }`}
              >
                {sceneTask(scene.id)?.status === "running"
                  ? "生成中"
                  : scene.hasImage || scene.status === "in-use"
                    ? "使用中"
                    : "草稿"}
              </Badge>
              <ShapingBadge status={scene.shapingStatus} />
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
                  onClick={(event) => {
                    event.stopPropagation()
                    handleOpenCanvas(toCanvasLaunchSource(scene))
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
                    handleEdit(scene)
                  }}
                  className="flex-1 bg-white/20 backdrop-blur-md text-white text-[10px] font-bold py-2 rounded-lg border border-white/30 hover:bg-white/40 transition-colors"
                >
                  {sceneTask(scene.id)?.status === "running"
                    ? "查看进度"
                    : isDraftScene(scene)
                      ? "生成"
                      : "编辑"}
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
                        void handleDelete(scene.id)
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
          </div>
          <div className="p-3">
            <h3 className="cn-keep text-sm font-extrabold text-[hsl(var(--on-surface))] mb-1">{scene.name}</h3>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[hsl(var(--secondary))] font-medium">修改于 {scene.modified}</span>
              <Badge variant="secondary" className="text-[10px] bg-[hsl(var(--secondary-container))] text-[hsl(var(--on-secondary-container))] px-2 py-0.5 rounded-full font-bold border-0">
                {scene.code}
              </Badge>
            </div>
          </div>
        </div>
      ))}

      <AssetDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        image={selectedSceneLive?.image}
        name={selectedSceneLive?.name ?? ""}
        badge={
          selectedSceneLive ? (
            <span className="flex items-center gap-1.5">
              <AssetDetailBadge className={sceneStatusClass(selectedSceneLive)}>
                {sceneStatusLabel(selectedSceneLive)}
              </AssetDetailBadge>
              <ShapingBadge status={selectedSceneLive.shapingStatus} />
            </span>
          ) : undefined
        }
        metas={
          selectedSceneLive
            ? [
                {
                  icon: <Clock className="w-4 h-4" />,
                  label: "最近修改",
                  value: selectedSceneLive.modified,
                },
                {
                  icon: <Hash className="w-4 h-4" />,
                  label: "场景编号",
                  value: selectedSceneLive.code,
                },
                ...(selectedSceneLive.model
                  ? [
                      {
                        icon: <Settings className="w-4 h-4" />,
                        label: "生成模型",
                        value: selectedSceneLive.model,
                      },
                    ]
                  : []),
              ]
            : []
        }
        aspectRatio={selectedSceneLive?.aspectRatio}
        prompt={selectedSceneLive?.description}
        assetId={selectedSceneLive?.id}
        extra={
          selectedSceneLive ? (
            <ShapingPanel
              status={selectedSceneLive.shapingStatus}
              prompt={selectedSceneLive.description}
              busy={lockingPrompt}
              onLock={() => void handleSetPromptLock(selectedSceneLive, true)}
              onUnlock={() => void handleSetPromptLock(selectedSceneLive, false)}
            />
          ) : undefined
        }
        onOpenCanvas={
          selectedSceneLive
            ? () =>
                handleOpenCanvas(toCanvasLaunchSource(selectedSceneLive))
            : undefined
        }
      />

      {/* Scene Creator / Editor */}
      <SceneCreator
        open={creatorOpen}
        onOpenChange={setCreatorOpen}
        onUpdate={handleUpdate}
        initialData={editSceneLive}
        projectId={projectId}
        mode={editSceneLive ? (isDraftScene(editSceneLive) ? "generate" : "edit") : "create"}
        lockingPrompt={lockingPrompt}
        onSetPromptLock={editSceneLive ? (locked) => handleSetPromptLock(editSceneLive, locked) : undefined}
      />
    </div>
  )
}
