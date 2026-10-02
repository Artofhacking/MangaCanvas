import { Clock, Hash, Image as ImageIcon, MapPin, Settings, Sparkles } from "lucide-react"
import AssetDetailDialog, { AssetDetailBadge } from "./tabs/AssetDetailDialog"
import { ShapingBadge } from "@/features/project/ShapingPanel"
import type { EpisodeAssetPreview } from "./episodeAssetPreview"

const OBJECT_TYPE_BADGE: Record<string, string> = {
  武器: "bg-red-500",
  道具: "bg-blue-500",
  服装: "bg-purple-500",
  场景装饰: "bg-emerald-500",
  AI生成: "bg-orange-500",
  上传: "bg-cyan-500",
}

function previewBadge(preview: EpisodeAssetPreview) {
  if (preview.kind === "character") {
    return (
      <span className="flex items-center gap-1.5">
        {preview.role ? (
          <AssetDetailBadge
            className={
              preview.role === "主角"
                ? "bg-[hsl(var(--primary))] text-white"
                : "bg-[hsl(var(--secondary))] text-white"
            }
          >
            {preview.role}
          </AssetDetailBadge>
        ) : null}
        <ShapingBadge status={preview.shapingStatus} />
      </span>
    )
  }

  if (preview.kind === "scene") {
    return (
      <span className="flex items-center gap-1.5">
        <AssetDetailBadge
          className={
            preview.statusActive
              ? "bg-[hsl(var(--primary))] text-white"
              : "bg-[hsl(var(--surface-container-highest))] text-[hsl(var(--on-secondary-fixed-variant))]"
          }
        >
          {preview.statusLabel || "草稿"}
        </AssetDetailBadge>
        <ShapingBadge status={preview.shapingStatus} />
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1.5">
      {preview.objectType ? (
        <AssetDetailBadge
          className={`${OBJECT_TYPE_BADGE[preview.objectType] ?? "bg-[hsl(var(--secondary))]"} text-white`}
        >
          {preview.objectType}
        </AssetDetailBadge>
      ) : null}
      {preview.inUse ? <AssetDetailBadge className="bg-[hsl(var(--primary))] text-white">使用中</AssetDetailBadge> : null}
      <ShapingBadge status={preview.shapingStatus} />
    </span>
  )
}

function previewMetas(preview: EpisodeAssetPreview) {
  if (preview.kind === "character") {
    return [
      ...(preview.style
        ? [{ icon: <Sparkles className="h-4 w-4" />, label: "风格", value: preview.style }]
        : []),
      ...(preview.sceneCount !== undefined
        ? [{ icon: <ImageIcon className="h-4 w-4" />, label: "关联场景", value: `${preview.sceneCount} 个场景` }]
        : []),
      ...(preview.model
        ? [{ icon: <Settings className="h-4 w-4" />, label: "生成模型", value: preview.model }]
        : []),
    ]
  }

  if (preview.kind === "scene") {
    return [
      ...(preview.modified
        ? [{ icon: <Clock className="h-4 w-4" />, label: "最近修改", value: preview.modified }]
        : []),
      ...(preview.code
        ? [{ icon: <Hash className="h-4 w-4" />, label: "场景编号", value: preview.code }]
        : []),
      ...(preview.model
        ? [{ icon: <Settings className="h-4 w-4" />, label: "生成模型", value: preview.model }]
        : []),
    ]
  }

  return [
    ...(preview.objectScene
      ? [{ icon: <MapPin className="h-4 w-4" />, label: "关联场景", value: preview.objectScene }]
      : []),
    ...(preview.modified
      ? [{ icon: <Clock className="h-4 w-4" />, label: "最近修改", value: preview.modified }]
      : []),
    ...(preview.model
      ? [{ icon: <Settings className="h-4 w-4" />, label: "生成模型", value: preview.model }]
      : []),
  ]
}

export default function EpisodeAssetDetailDialog({
  open,
  onOpenChange,
  preview,
  onOpenCanvas,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preview: EpisodeAssetPreview | null
  onOpenCanvas?: () => void
}) {
  return (
    <AssetDetailDialog
      open={open}
      onOpenChange={onOpenChange}
      image={preview?.image}
      name={preview?.name ?? ""}
      badge={preview ? previewBadge(preview) : undefined}
      metas={preview ? previewMetas(preview) : []}
      aspectRatio={preview?.aspectRatio}
      prompt={preview?.prompt}
      assetId={preview?.id}
      onOpenCanvas={onOpenCanvas}
    />
  )
}
