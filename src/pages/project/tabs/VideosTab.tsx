import { useState } from "react"
import { Check, Clock, Film, Play, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { mediaUrl } from "@/lib/mediaUrl"
import { toCanvasLaunchSource } from "@/lib/workflows"
import type { ProjectVideo } from "@/lib/projectVideos"
import { useProjectStore } from "@/store/projectStore"
import type { CanvasLaunchSource } from "@/types"
import AssetDetailDialog, { AssetDetailBadge } from "./AssetDetailDialog"
import AssetQuickCreateCard from "./AssetQuickCreateCard"

interface VideosTabProps {
  projectId?: number | null
  videos?: ProjectVideo[]
  error?: string | null
  onRetry?: () => void
  onUpload?: () => void
  onOpenCanvas?: (source?: CanvasLaunchSource) => void
  batchMode?: boolean
  selectedIds?: number[]
  onToggleSelect?: (id: number) => void
}

const formatVideoTime = (iso?: string) => {
  if (!iso) return "刚刚"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "刚刚"
  return date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function VideosTab({
  projectId,
  videos: videosProp,
  error,
  onRetry,
  onUpload,
  onOpenCanvas,
  batchMode = false,
  selectedIds = [],
  onToggleSelect,
}: VideosTabProps) {
  const storedVideos = useProjectStore((state) => state.assets.videos)
  const videos = videosProp ?? storedVideos
  const deleteVideo = useProjectStore((state) => state.deleteVideo)
  const { confirm, notify } = useFeedback()
  const [selected, setSelected] = useState<ProjectVideo | null>(null)
  const selectedLive = selected ? videos.find((item) => item.id === selected.id) ?? selected : null

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: "删除视频",
      description: "删除后将从视频库移除，无法恢复。",
      confirmText: "删除",
      tone: "danger",
    })
    if (!confirmed || !projectId) return
    const removed = await deleteVideo(projectId, id)
    if (!removed) {
      notify.error(useProjectStore.getState().error || "删除视频失败")
      return
    }
    if (selected?.id === id) setSelected(null)
    notify.success("视频已删除")
  }

  const handleOpenCanvas = (source?: CanvasLaunchSource) => {
    if (onOpenCanvas) {
      onOpenCanvas(source)
      return
    }
    notify.info("无限画布暂时无法从这里打开")
  }

  const openDetail = (video: ProjectVideo) => {
    if (batchMode) {
      onToggleSelect?.(video.id)
      return
    }
    setSelected(video)
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-[hsl(var(--outline-variant))]/60 bg-[hsl(var(--surface-container-low))] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[hsl(var(--on-surface))]">视频加载失败</p>
            <p className="mt-1 text-sm text-[hsl(var(--secondary))]">{error}</p>
          </div>
          {onRetry ? (
            <Button
              type="button"
              variant="outline"
              onClick={onRetry}
              className="rounded-xl border-[hsl(var(--outline-variant))]/40"
            >
              重试
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AssetQuickCreateCard
          variant="video"
          title="添加视频"
          description="上传成片，或到画布里继续做"
          uploadHint="视频进库"
          onUpload={onUpload}
          onOpenCanvas={() => handleOpenCanvas()}
        />

        {videos.map((video) => (
          <div
            key={video.id}
            onClick={() => openDetail(video)}
            className={`group relative cursor-pointer overflow-hidden rounded-xl bg-[hsl(var(--surface-container-lowest))] transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-[hsl(var(--on-surface))]/5 ${batchMode ? "ring-2 ring-transparent" : ""} ${selectedIds.includes(video.id) ? "ring-[hsl(var(--primary))]" : ""}`}
          >
            <div className="relative aspect-video w-full overflow-hidden bg-black">
              <video
                src={mediaUrl(video.url)}
                className="h-full w-full object-cover"
                muted
                playsInline
                preload="metadata"
              />
              <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1">
                <span className="rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-bold text-white">视频</span>
              </div>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-80 transition-opacity group-hover:opacity-0">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white">
                  <Play className="h-4 w-4 fill-current" />
                </span>
              </div>
              {batchMode ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onToggleSelect?.(video.id)
                  }}
                  className={`absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border ${selectedIds.includes(video.id) ? "border-transparent bg-[hsl(var(--primary))] text-white" : "border-white/60 bg-black/30 text-transparent"}`}
                >
                  <Check className="h-4 w-4" />
                </button>
              ) : (
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-[hsl(var(--on-surface))]/60 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex w-full gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleOpenCanvas(toCanvasLaunchSource({
                          id: video.id,
                          name: video.name,
                          description: video.prompt,
                          video: video.url,
                          mediaType: "video",
                          hasVideo: true,
                          hasImage: false,
                        }))
                      }}
                      className="flex-1 rounded-lg border border-white/30 bg-white/20 py-2 text-[10px] font-bold text-white backdrop-blur-md hover:bg-white/40"
                    >
                      打开画布
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleDelete(video.id)
                      }}
                      className="rounded-lg border border-white/30 bg-white/20 px-3 py-2 text-[10px] font-bold text-white backdrop-blur-md hover:bg-white/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="p-3">
              <h3 className="cn-keep mb-1 truncate text-sm font-bold text-[hsl(var(--on-surface))]">{video.name}</h3>
              <p className="truncate text-[13px] text-[hsl(var(--secondary))]">{video.prompt || "暂无提示词"}</p>
              <p className="mt-1 text-[13px] text-[hsl(var(--secondary))]">{formatVideoTime(video.updatedAt || video.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>

      {!error && videos.length === 0 ? (
        <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--outline-variant))]/60 bg-[hsl(var(--surface-container-low))] px-6 py-10 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10">
            <Film className="h-7 w-7 text-[hsl(var(--primary))]" />
          </div>
          <h3 className="text-lg font-black text-[hsl(var(--on-surface))]">还没有项目视频</h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-[hsl(var(--secondary))]">
            在无限画布里把成片「保存到素材库」并选视频，或直接上传，都会出现在这里。
          </p>
        </div>
      ) : null}

      <AssetDetailDialog
        open={Boolean(selectedLive)}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        image={selectedLive ? mediaUrl(selectedLive.url) : undefined}
        mediaType="video"
        name={selectedLive?.name ?? ""}
        badge={<AssetDetailBadge className="bg-black text-white">视频</AssetDetailBadge>}
        metas={
          selectedLive
            ? [
                {
                  icon: <Film className="h-4 w-4" />,
                  label: "类型",
                  value: "视频",
                },
                {
                  icon: <Clock className="h-4 w-4" />,
                  label: "更新时间",
                  value: formatVideoTime(selectedLive.updatedAt || selectedLive.createdAt),
                },
              ]
            : []
        }
        prompt={selectedLive?.prompt}
        assetId={selectedLive?.id}
        onOpenCanvas={
          selectedLive
            ? () =>
                handleOpenCanvas(toCanvasLaunchSource({
                  id: selectedLive.id,
                  name: selectedLive.name,
                  description: selectedLive.prompt,
                  video: selectedLive.url,
                  mediaType: "video",
                  hasVideo: true,
                  hasImage: false,
                }))
            : undefined
        }
      />
    </div>
  )
}
