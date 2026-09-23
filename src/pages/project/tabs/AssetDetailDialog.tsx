import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RectangleHorizontal } from "lucide-react"
import type { ReactNode } from "react"

export function formatAssetAspectRatio(ratio?: string | null) {
  const value = ratio?.trim()
  return value ? value : "—"
}

export interface AssetDetailMeta {
  icon: ReactNode
  label: string
  value: string
}

interface AssetDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  image?: string
  mediaType?: "image" | "video"
  name: string
  badge?: ReactNode
  metas?: AssetDetailMeta[]
  aspectRatio?: string | null
  prompt?: string
  assetId?: number
  onOpenCanvas?: () => void
  extra?: ReactNode
}

export default function AssetDetailDialog({
  open,
  onOpenChange,
  image,
  mediaType = "image",
  name,
  badge,
  metas = [],
  aspectRatio,
  prompt,
  assetId,
  onOpenCanvas,
  extra,
}: AssetDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <div className="flex flex-col md:flex-row">
          <div className="w-full md:w-1/2 aspect-square md:aspect-auto md:min-h-[360px] bg-[hsl(var(--surface-container-low))]">
            {image ? (
              mediaType === "video" ? (
                <video
                  src={image}
                  className="h-full w-full bg-black object-contain"
                  controls
                  playsInline
                  preload="metadata"
                />
              ) : (
                <img src={image} alt={name} className="w-full h-full object-cover" />
              )
            ) : (
              <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-[hsl(var(--secondary))]">
                暂无预览
              </div>
            )}
          </div>

          <div className="w-full md:w-1/2 p-6 flex flex-col">
            <DialogHeader className="mb-4">
              <div className="flex items-center gap-3 pr-6">
                <DialogTitle className="text-xl font-bold">{name}</DialogTitle>
                {badge}
              </div>
            </DialogHeader>

            <div className="space-y-4 flex-1">
              {[
                ...metas,
                {
                  icon: <RectangleHorizontal className="w-4 h-4" />,
                  label: "比例",
                  value: formatAssetAspectRatio(aspectRatio),
                },
              ].map((meta) => (
                <div key={meta.label} className="flex items-start gap-3">
                  <div className="text-[hsl(var(--secondary))] mt-0.5">{meta.icon}</div>
                  <div>
                    <p className="text-xs text-[hsl(var(--secondary))]">{meta.label}</p>
                    <p className="text-sm font-medium text-[hsl(var(--on-surface))]">{meta.value}</p>
                  </div>
                </div>
              ))}

              <div className={metas.length > 0 ? "pt-4 border-t border-[hsl(var(--outline-variant))]/30" : ""}>
                <p className="text-xs text-[hsl(var(--secondary))] mb-2">提示词</p>
                <p className="text-sm text-[hsl(var(--on-surface))] leading-relaxed bg-[hsl(var(--surface-container-low))] p-3 rounded-lg whitespace-pre-wrap">
                  {prompt?.trim() || "暂无提示词"}
                </p>
              </div>
              {extra ? <div className="pt-4">{extra}</div> : null}
            </div>

            <div className="mt-6 pt-4 border-t border-[hsl(var(--outline-variant))]/30 flex items-center justify-between gap-3 text-xs text-[hsl(var(--secondary))]">
              <span>ID: {assetId ?? "—"}</span>
              {onOpenCanvas && (
                <button
                  type="button"
                  onClick={onOpenCanvas}
                  className="rounded-xl bg-[hsl(var(--primary))] px-3 py-2 text-xs font-bold text-white"
                >
                  打开画布
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function AssetDetailBadge({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <Badge className={`text-[10px] font-bold px-2 py-0.5 rounded-full border-0 ${className ?? ""}`}>
      {children}
    </Badge>
  )
}
