import type { CharacterCreateData } from "@/types"
import AssetBatchUploadDialog from "./AssetBatchUploadDialog"

interface CharacterBatchUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: number
  onCreate: (data: CharacterCreateData) => Promise<CharacterCreateData | null | void>
}

/** @deprecated Prefer AssetBatchUploadDialog with kind="character". Kept for existing imports. */
export default function CharacterBatchUploadDialog({
  onCreate,
  ...props
}: CharacterBatchUploadDialogProps) {
  return (
    <AssetBatchUploadDialog
      {...props}
      kind="character"
      onCreate={async (data) => {
        const created = await onCreate(data as CharacterCreateData)
        return created === undefined ? true : created
      }}
    />
  )
}
