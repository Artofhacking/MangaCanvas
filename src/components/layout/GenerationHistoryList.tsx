import { useMemo, useState } from "react"
import { Image as ImageIcon, Loader2, Sparkles, Video } from "lucide-react"

import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { mediaUrl } from "@/lib/mediaUrl"
import { useAssetGenerationStore } from "@/store/assetGenerationStore"
import {
  ASSET_KIND_LABEL,
  formatRelativeTime,
  MEDIA_TYPE_LABEL,
  mergeGenerationHistory,
  STATUS_LABEL,
  type GenerationHistoryItem,
  type GenerationStatus,
  useGenerationHistoryStore,
} from "@/store/generationHistoryStore"

const statusClass: Record<GenerationStatus, string> = {
  succeeded: "bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))]",
  failed: "bg-red-500/10 text-red-500",
  running: "bg-[hsl(var(--surface-container-high))] text-[hsl(var(--on-surface-variant))]",
}

function sourceLabel(item: GenerationHistoryItem) {
  if (item.source && ASSET_KIND_LABEL[item.source]) return ASSET_KIND_LABEL[item.source]
  return MEDIA_TYPE_LABEL[item.mediaType]
}

export default function GenerationHistoryList() {
  const { notify } = useFeedback()
  const historyItems = useGenerationHistoryStore((state) => state.items)
  const assetTasks = useAssetGenerationStore((state) => state.tasks)
  const items = useMemo(
    () => mergeGenerationHistory(historyItems, assetTasks),
    [assetTasks, historyItems]
  )
  const [preview, setPreview] = useState<GenerationHistoryItem | null>(null)

  const handleOpen = (item: GenerationHistoryItem) => {
    if (item.resultUrl || item.thumbnailUrl) {
      setPreview(item)
      return
    }
    notify.info(
      item.status === "running" ? "任务仍在生成中，完成后可预览结果" : "这条记录没有可预览的结果",
      "暂无预览"
    )
  }

  return (
    <div className="relative h-full min-h-0">
      {items.length === 0 ? (
        <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center text-[hsl(var(--secondary))]">
          <Sparkles className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm">暂无生成记录</p>
          <p className="mt-1 text-xs text-[hsl(var(--secondary))]">提交图片或视频生成后会显示在这里</p>
        </div>
      ) : (
        <div className="h-full space-y-2 overflow-y-auto">
          {items.map((item) => {
            const thumb = mediaUrl(item.thumbnailUrl)
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleOpen(item)}
                className="w-full rounded-xl border border-transparent bg-[hsl(var(--surface-container-low))] p-3 text-left transition-colors hover:bg-[hsl(var(--surface-container-high))]"
              >
                <div className="flex items-start gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[hsl(var(--surface-container-high))]">
                    {thumb && item.mediaType === "image" ? (
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                    ) : thumb && item.mediaType === "video" ? (
                      <video src={thumb} muted className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[hsl(var(--secondary))]">
                        {item.status === "running" ? (
                          <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--primary))]" />
                        ) : item.mediaType === "video" ? (
                          <Video className="h-5 w-5" />
                        ) : (
                          <ImageIcon className="h-5 w-5" />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-[hsl(var(--on-surface))]">{item.title}</h3>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass[item.status]}`}>
                        {STATUS_LABEL[item.status]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[hsl(var(--secondary))]">
                      {sourceLabel(item)} · {MEDIA_TYPE_LABEL[item.mediaType]}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-[hsl(var(--on-surface-variant))]">
                      {item.prompt || item.error || "无提示词"}
                    </p>
                    <p className="mt-2 text-[10px] text-[hsl(var(--secondary))]">{formatRelativeTime(item.createdAt)}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {preview ? (
        <div className="absolute inset-0 z-20 flex flex-col bg-[hsl(var(--surface))]">
          <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--outline-variant))]/15 px-1 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[hsl(var(--on-surface))]">{preview.title}</p>
              <p className="truncate text-[11px] text-[hsl(var(--secondary))]">
                {sourceLabel(preview)} · {MEDIA_TYPE_LABEL[preview.mediaType]}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="h-8 shrink-0 rounded-lg px-2 text-xs text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-high))] hover:text-[hsl(var(--on-surface))]"
            >
              关闭预览
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-3">
            <div className="overflow-hidden rounded-xl bg-[hsl(var(--surface-container-low))]">
              {preview.mediaType === "video" ? (
                <video
                  src={mediaUrl(preview.resultUrl || preview.thumbnailUrl)}
                  controls
                  className="max-h-[360px] w-full bg-black object-contain"
                />
              ) : (
                <img
                  src={mediaUrl(preview.resultUrl || preview.thumbnailUrl)}
                  alt={preview.title}
                  className="max-h-[360px] w-full object-contain"
                />
              )}
            </div>
            {preview.prompt ? (
              <p className="mt-3 text-xs leading-5 text-[hsl(var(--on-surface-variant))]">{preview.prompt}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
