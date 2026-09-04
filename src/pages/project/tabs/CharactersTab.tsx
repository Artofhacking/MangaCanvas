import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { MouseEvent } from "react"
import { useState } from "react"
import { Trash2, Check, ArrowRight, Wand2, Workflow, User, Sparkles, Image, Settings, Pencil } from "lucide-react"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { useProjectStore } from "@/store/projectStore"
import type { Character, CharacterCreateData, CharacterEditData } from "@/types"
import CharacterCreator from "../CharacterCreator"


interface CharactersTabProps {
  projectId?: number | null
  characters?: Character[]
  onAddNew?: () => void
  onOpenCanvas?: () => void
  batchMode?: boolean
  selectedIds?: number[]
  onToggleSelect?: (id: number) => void
}

export default function CharactersTab({
  projectId,
  characters: charactersProp,
  onAddNew,
  onOpenCanvas,
  batchMode = false,
  selectedIds = [],
  onToggleSelect,
}: CharactersTabProps) {
  const characters = useProjectStore((state) => charactersProp ?? state.assets.characters)
  const { deleteCharacter, updateCharacter, createCharacter } = useProjectStore()
  const { confirm, notify } = useFeedback()
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  
  // Creator state
  const [editCharacter, setEditCharacter] = useState<Character | null>(null)
  const [creatorOpen, setCreatorOpen] = useState(false)

  const handleDelete = async (e: MouseEvent<HTMLButtonElement>, id: number) => {
    e.stopPropagation()
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
    notify.success("角色创建成功")
  }

  const handleUpdate = async (data: CharacterEditData) => {
    if (!projectId) return
    const roleMap: Record<string, '主角' | '配角'> = { main: '主角', support: '配角' }
    const updateData: Partial<Character> = {
      ...data,
      role: data.role ? roleMap[data.role] : undefined,
    }
    await updateCharacter(projectId, data.id, updateData)
    setCreatorOpen(false)
    setEditCharacter(null)
    notify.success("角色已更新")
  }

  const handleOpenCanvas = () => {
    if (onOpenCanvas) {
      onOpenCanvas()
      return
    }

    notify.info("无限画布创作模式正在接入角色工作流")
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
        {/* Add New Character Card */}
        <div
          className="aspect-[4/5] rounded-lg border-2 border-dashed border-[hsl(var(--outline-variant))] bg-[linear-gradient(180deg,hsl(var(--surface-container))_0%,hsl(var(--surface-container-low))_100%)] p-3.5 transition-all hover:border-[hsl(var(--primary))]/35 hover:shadow-lg hover:shadow-[hsl(var(--primary))]/5"
        >
          <div className="mb-5 pt-2">
            <h3 className="text-sm font-bold text-[hsl(var(--on-surface))]">添加角色</h3>
            <p className="mt-1 text-[11px] leading-5 text-[hsl(var(--secondary))]">
              选择创作方式。
            </p>
          </div>

          <div className="mt-auto space-y-2">
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
                  <div className="text-[10px] text-[hsl(var(--secondary))]">快速建角色</div>
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
            <div className={`absolute top-2 right-2 flex flex-col gap-2 transition-all ${batchMode ? "opacity-0 pointer-events-none" : "opacity-0 group-hover:opacity-100"}`}>
              <button
                type="button"
                onClick={(e) => handleEdit(character, e)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-[hsl(var(--primary))]"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={(e) => handleDelete(e, character.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="p-2.5">
            <h3 className="text-xs font-bold text-[hsl(var(--on-surface))] truncate">{character.name}</h3>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[9px] text-[hsl(var(--secondary))] truncate max-w-[60%]">{character.style}</span>
              <span className="text-[9px] text-[hsl(var(--secondary))]">{character.scenes}场景</span>
            </div>
          </div>
        </div>
      ))}

      </div>

      {/* Character Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          {selectedCharacter && (
            <div className="flex flex-col md:flex-row">
              {/* Image Section */}
              <div className="w-full md:w-1/2 aspect-square md:aspect-auto">
                <img
                  src={selectedCharacter.image}
                  alt={selectedCharacter.name}
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Info Section */}
              <div className="w-full md:w-1/2 p-6 flex flex-col">
                <DialogHeader className="mb-4">
                  <div className="flex items-center gap-3">
                    <DialogTitle className="text-xl font-bold">{selectedCharacter.name}</DialogTitle>
                    <Badge 
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border-0 ${
                        selectedCharacter.role === "主角" 
                          ? "bg-[hsl(var(--primary))] text-white" 
                          : "bg-[hsl(var(--secondary))] text-white"
                      }`}
                    >
                      {selectedCharacter.role}
                    </Badge>
                  </div>
                </DialogHeader>

                <div className="space-y-4 flex-1">
                  {/* Style */}
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-4 h-4 text-[hsl(var(--secondary))] mt-0.5" />
                    <div>
                      <p className="text-xs text-[hsl(var(--secondary))]">风格</p>
                      <p className="text-sm font-medium text-[hsl(var(--on-surface))]">{selectedCharacter.style}</p>
                    </div>
                  </div>

                  {/* Scenes */}
                  <div className="flex items-start gap-3">
                    <Image className="w-4 h-4 text-[hsl(var(--secondary))] mt-0.5" />
                    <div>
                      <p className="text-xs text-[hsl(var(--secondary))]">关联场景</p>
                      <p className="text-sm font-medium text-[hsl(var(--on-surface))]">{selectedCharacter.scenes} 个场景</p>
                    </div>
                  </div>

                  {/* Gender & Age */}
                  <div className="flex items-start gap-3">
                    <User className="w-4 h-4 text-[hsl(var(--secondary))] mt-0.5" />
                    <div>
                      <p className="text-xs text-[hsl(var(--secondary))]">基本信息</p>
                      <p className="text-sm font-medium text-[hsl(var(--on-surface))]">
                        {selectedCharacter.gender || "未知性别"} · {selectedCharacter.ageGroup || "未知年龄"}
                      </p>
                    </div>
                  </div>

                  {/* Model */}
                  {selectedCharacter.model && (
                    <div className="flex items-start gap-3">
                      <Settings className="w-4 h-4 text-[hsl(var(--secondary))] mt-0.5" />
                      <div>
                        <p className="text-xs text-[hsl(var(--secondary))]">生成模型</p>
                        <p className="text-sm font-medium text-[hsl(var(--on-surface))]">{selectedCharacter.model}</p>
                      </div>
                    </div>
                  )}

                  {/* Description / Prompt */}
                  {selectedCharacter.description && (
                    <div className="pt-4 border-t border-[hsl(var(--outline-variant))]/30">
                      <p className="text-xs text-[hsl(var(--secondary))] mb-2">提示词</p>
                      <p className="text-sm text-[hsl(var(--on-surface))] leading-relaxed bg-[hsl(var(--surface-container-low))] p-3 rounded-lg">
                        {selectedCharacter.description}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-[hsl(var(--outline-variant))]/30 flex items-center justify-between text-xs text-[hsl(var(--secondary))]">
                  <span>ID: {selectedCharacter.id}</span>
                  <span>创建于 2024</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Character Creator / Editor */}
      <CharacterCreator
        open={creatorOpen}
        onOpenChange={setCreatorOpen}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        initialData={editCharacter}
        mode={editCharacter ? 'edit' : 'create'}
      />
    </div>
  )
}
