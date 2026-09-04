import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import { X } from "lucide-react"
import type { CharacterCreateData, CharacterEditData, Character } from "@/types"
import CharacterForm from "./CharacterForm"

interface CharacterCreatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate?: (data: CharacterCreateData) => void
  onUpdate?: (data: CharacterEditData) => void
  initialData?: Character | null
  mode?: 'create' | 'edit'
}

export default function CharacterCreator({
  open,
  onOpenChange,
  onCreate,
  onUpdate,
  initialData,
  mode = 'create'
}: CharacterCreatorProps) {
  const isEditMode = mode === 'edit' && initialData != null

  const handleSubmit = (data: CharacterCreateData | CharacterEditData) => {
    if ('id' in data) {
      onUpdate?.(data as CharacterEditData)
    } else {
      onCreate?.(data as CharacterCreateData)
    }
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[900px] sm:max-w-[900px] p-0 overflow-hidden bg-[hsl(var(--surface))]" style={{ maxWidth: '900px' }} hideCloseButton>
        <SheetTitle className="sr-only">{isEditMode ? "编辑角色" : "新建角色"}</SheetTitle>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface))]">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-5 h-5" />
            </Button>
            <h2 className="text-xl font-bold text-[hsl(var(--on-surface))]">{isEditMode ? "编辑角色" : "新建角色"}</h2>
          </div>
        </div>

        {/* Content */}
        <div className="h-[calc(100vh-70px)] overflow-y-auto p-6 pb-28">
          <CharacterForm
            mode={mode}
            initialData={initialData}
            onSubmit={handleSubmit}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
