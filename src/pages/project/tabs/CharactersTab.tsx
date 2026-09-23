import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useState } from "react"
import { Trash2, Check, Sparkles, Image, Settings, MoreHorizontal } from "lucide-react"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { useProjectStore } from "@/store/projectStore"
import type { CanvasLaunchSource, Character, CharacterCreateData, CharacterEditData } from "@/types"
import ShapingPanel, { ShapingBadge } from "@/features/project/ShapingPanel"
import CharacterCreator from "../CharacterCreator"
import AssetDetailDialog, { AssetDetailBadge } from "./AssetDetailDialog"
import AssetQuickCreateCard from "./AssetQuickCreateCard"


interface CharactersTabProps {
  projectId?: number | null
  characters?: Character[]
  onAddNew?: () => void
  onUpload?: () => void
  onOpenCanvas?: (source?: CanvasLaunchSource) => void
  batchMode?: boolean
  selectedIds?: number[]
  onToggleSelect?: (id: number) => void
}

export default function CharactersTab({
  projectId,
  characters: charactersProp,
  onAddNew,
  onUpload,
  onOpenCanvas,
  batchMode = false,
  selectedIds = [],
  onToggleSelect,
}: CharactersTabProps) {
  const characters = useProjectStore((state) => charactersProp ?? state.assets.characters)
  const { deleteCharacter, updateCharacter, createCharacter, setCharacterPromptLock } = useProjectStore()
  const { confirm, notify } = useFeedback()
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  
  // Creator state
  const [editCharacter, setEditCharacter] = useState<Character | null>(null)
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [lockingPrompt, setLockingPrompt] = useState(false)
  const selectedCharacterLive = selectedCharacter
    ? characters.find((item) => item.id === selectedCharacter.id) ?? selectedCharacter
    : null
  const editCharacterLive = editCharacter
    ? characters.find((item) => item.id === editCharacter.id) ?? editCharacter
    : null

  const handleDelete = async (id: number, event?: { stopPropagation: () => void }) => {
    event?.stopPropagation()
    const confirmed = await confirm({
      title: "删除角色",
      description: "删除后将无法恢复这个角色资料。",
      confirmText: "删除",
      tone: "danger",
    })

    if (confirmed) {
      if (!projectId) return
      await deleteCharacter(projectId, id)
      notify.success("角色已删除")
    }
  }

  const handleAddNew = () => {
    if (onAddNew) {
      onAddNew()
    } else {
      setEditCharacter(null)
      setCreatorOpen(true)
    }
  }

  const handleEdit = (character: Character, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditCharacter(character)
    setCreatorOpen(true)
    setDetailOpen(false)
  }

  const handleCreate = async (data: CharacterCreateData) => {
    if (!projectId) return
    await createCharacter(projectId, data)
    notify.success("角色已加入素材库")
  }

  const handleUpdate = async (data: CharacterEditData) => {
    if (!projectId) return
    const roleMap: Record<string, '主角' | '配角'> = { main: '主角', support: '配角' }
    await updateCharacter(projectId, data.id, {
      name: data.name,
      gender: data.gender,
      ageGroup: data.ageGroup,
      style: data.style,
      description: data.description,
      model: data.model,
      aspectRatio: data.aspectRatio,
      role: data.role ? roleMap[data.role] : undefined,
      ...(data.referenceImage ? { image: data.referenceImage, hasImage: true } : {}),
    })
    notify.success(data.referenceImage ? "角色已生成并加入素材库" : "角色已保存")
  }

  const handleOpenCanvas = (source?: CanvasLaunchSource) => {
    if (onOpenCanvas) {
      onOpenCanvas(source)
      return
    }

    notify.info("无限画布创作模式正在接入角色工作流")
  }

  const handleSetPromptLock = async (character: Character, locked: boolean) => {
    if (!projectId) return
    setLockingPrompt(true)
    const updated = await setCharacterPromptLock(projectId, character.id, locked)
    setLockingPrompt(false)
    if (!updated) {
      notify.error(useProjectStore.getState().error || (locked ? "锁定提示词失败" : "解锁失败"))
      return
    }
    setSelectedCharacter(updated)
    setEditCharacter((current) => (current?.id === updated.id ? updated : current))
    notify.success(locked ? "提示词已锁定" : "已解锁，回到还没定")
  }

  const handleCardClick = (character: Character) => {
    if (batchMode) {
      onToggleSelect?.(character.id)
      return
    }
    setSelectedCharacter(character)
    setDetailOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
        <AssetQuickCreateCard
          variant="character"
          title="添加角色"
          description="选择创作方式。"
          quickHint="快速建角色"
          onQuickCreate={handleAddNew}
          onUpload={onUpload}
          onOpenCanvas={() => handleOpenCanvas()}
        />

        {/* Character Cards */}
        {characters.map((character) => (
        <div 
          key={character.id}
          onClick={() => handleCardClick(character)}
          className={`group relative rounded-lg overflow-hidden bg-[hsl(var(--surface-container-lowest))] transition-all hover:shadow-lg hover:shadow-[hsl(var(--on-surface))]/5 hover:-translate-y-0.5 ${batchMode ? "cursor-pointer ring-2 ring-transparent" : "cursor-pointer"} ${selectedIds.includes(character.id) ? "ring-[hsl(var(--primary))]" : ""}`}
        >
          <div className="aspect-[4/5] w-full relative overflow-hidden">
            <img 
              src={character.image} 
              alt={character.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute top-2 left-2 flex gap-1">
              <Badge 
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase border-0 ${
                  character.role === "主角" 
                    ? "bg-[hsl(var(--primary))] text-white" 
                    : "bg-[hsl(var(--secondary))] text-white"
                }`}
              >
                {character.role}
              </Badge>
              <ShapingBadge status={character.shapingStatus} />
            </div>
            {batchMode && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onToggleSelect?.(character.id)
                }}
                className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border ${selectedIds.includes(character.id) ? "border-transparent bg-[hsl(var(--primary))] text-white" : "border-white/60 bg-black/30 text-transparent"}`}
              >
                <Check className="h-4 w-4" />
              </button>
            )}
            <div className={`absolute inset-0 bg-gradient-to-t from-[hsl(var(--on-surface))]/60 to-transparent transition-opacity flex items-end p-3 ${batchMode ? "opacity-0 pointer-events-none" : "opacity-0 group-hover:opacity-100"}`}>
              <div className="flex gap-1.5 w-full">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation()
                    handleOpenCanvas({
                      id: character.id,
                      name: character.name,
                      image: character.image,
                      description: character.description,
                    })
                  }}
                  className="flex-1 bg-white/20 backdrop-blur-md text-white text-[10px] font-bold py-2 rounded-lg border border-white/30 hover:bg-white/40 transition-colors"
                >
                  打开画布
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(event) => handleEdit(character, event)}
                  className="flex-1 bg-white/20 backdrop-blur-md text-white text-[10px] font-bold py-2 rounded-lg border border-white/30 hover:bg-white/40 transition-colors"
                >
                  {character.hasImage ? "编辑" : "生成"}
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
                        void handleDelete(character.id)
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
          <div className="p-2.5">
            <h3 className="cn-keep text-xs font-bold text-[hsl(var(--on-surface))] truncate">{character.name}</h3>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[13px] text-[hsl(var(--secondary))] truncate max-w-[60%]">{character.style}</span>
              <span className="cn-nowrap text-[13px] text-[hsl(var(--secondary))]">{character.scenes}场景</span>
            </div>
          </div>
        </div>
      ))}

      </div>

      <AssetDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        image={selectedCharacterLive?.image}
        name={selectedCharacterLive?.name ?? ""}
        badge={
          selectedCharacterLive ? (
            <span className="flex items-center gap-1.5">
              <AssetDetailBadge
                className={
                  selectedCharacterLive.role === "主角"
                    ? "bg-[hsl(var(--primary))] text-white"
                    : "bg-[hsl(var(--secondary))] text-white"
                }
              >
                {selectedCharacterLive.role}
              </AssetDetailBadge>
              <ShapingBadge status={selectedCharacterLive.shapingStatus} />
            </span>
          ) : undefined
        }
        metas={
          selectedCharacterLive
            ? [
                {
                  icon: <Sparkles className="w-4 h-4" />,
                  label: "风格",
                  value: selectedCharacterLive.style,
                },
                {
                  icon: <Image className="w-4 h-4" />,
                  label: "关联场景",
                  value: `${selectedCharacterLive.scenes} 个场景`,
                },
                ...(selectedCharacterLive.model
                  ? [
                      {
                        icon: <Settings className="w-4 h-4" />,
                        label: "生成模型",
                        value: selectedCharacterLive.model,
                      },
                    ]
                  : []),
              ]
            : []
        }
        aspectRatio={selectedCharacterLive?.aspectRatio}
        prompt={selectedCharacterLive?.description}
        assetId={selectedCharacterLive?.id}
        extra={
          selectedCharacterLive ? (
            <ShapingPanel
              status={selectedCharacterLive.shapingStatus}
              prompt={selectedCharacterLive.description}
              busy={lockingPrompt}
              onLock={() => void handleSetPromptLock(selectedCharacterLive, true)}
              onUnlock={() => void handleSetPromptLock(selectedCharacterLive, false)}
            />
          ) : undefined
        }
        onOpenCanvas={
          selectedCharacterLive
            ? () =>
                handleOpenCanvas({
                  id: selectedCharacterLive.id,
                  name: selectedCharacterLive.name,
                  image: selectedCharacterLive.image,
                  description: selectedCharacterLive.description,
                })
            : undefined
        }
      />

      {/* Character Creator / Editor */}
      <CharacterCreator
        open={creatorOpen}
        onOpenChange={setCreatorOpen}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        initialData={editCharacterLive}
        mode={editCharacterLive ? 'edit' : 'create'}
        projectId={projectId}
        lockingPrompt={lockingPrompt}
        onSetPromptLock={
          editCharacterLive ? (locked) => handleSetPromptLock(editCharacterLive, locked) : undefined
        }
      />
    </div>
  )
}
