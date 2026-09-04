import { FolderOpen } from "lucide-react"

interface PlaceholderTabProps {
  label: string
}

export default function PlaceholderTab({ label }: PlaceholderTabProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 bg-[hsl(var(--surface-container-low))]/50 rounded-xl border border-dashed border-[hsl(var(--outline-variant))]">
      <div className="w-16 h-16 rounded-full bg-[hsl(var(--surface-container))] flex items-center justify-center mb-4">
        <FolderOpen className="w-8 h-8 text-[hsl(var(--secondary))]" />
      </div>
      <h3 className="text-lg font-bold text-[hsl(var(--on-surface))] mb-2">
        {label}
      </h3>
      <p className="text-sm text-[hsl(var(--secondary))]">
        该功能模块正在开发中，敬请期待...
      </p>
    </div>
  )
}
