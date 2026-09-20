import { useEffect, useMemo, useState } from "react"
import { Clock, Film, Image as ImageIcon, Sparkles, Star } from "lucide-react"

import { projectAssetsApi } from "@/api"
import type { ProjectAssetDTO } from "@/api/types"
import { QuerySpinner } from "@/components/feedback/ListQueryState"
import {
  collectCategoryLabel,
  collectFavoritedAt,
  inferCollectMediaType,
  isCollectedAsset,
} from "@/lib/favorites"
import { mediaUrl } from "@/lib/mediaUrl"
import AssetDetailDialog, { AssetDetailBadge } from "./AssetDetailDialog"

type FavoriteSort = "recent" | "name-asc" | "name-desc"

interface FavoritesTabProps {
  projectId?: number | null
  sortBy?: FavoriteSort
}

const relativeTime = (iso?: string) => {
  if (!iso) return "刚刚"
  const diff = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diff) || diff < 0) return "刚刚"
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "刚刚"
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return days < 7 ? `${days} 天前` : new Date(iso).toLocaleDateString("zh-CN")
}

export default function FavoritesTab({ projectId, sortBy = "recent" }: FavoritesTabProps) {
  const [items, setItems] = useState<ProjectAssetDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selected, setSelected] = useState<ProjectAssetDTO | null>(null)

  useEffect(() => {
    if (!projectId) {
      setItems([])
      setIsLoading(false)
      return
    }

    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
        const data = await projectAssetsApi.list(projectId, { page: 1, size: 200, collected: true })
        if (cancelled) return
        setItems((data.list || []).filter(isCollectedAsset))
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const favorites = useMemo(() => {
    const next = [...items]
    if (sortBy === "name-asc") {
      next.sort((left, right) => (left.name || "").localeCompare(right.name || "", "zh-CN"))
    } else if (sortBy === "name-desc") {
      next.sort((left, right) => (right.name || "").localeCompare(left.name || "", "zh-CN"))
    } else {
      next.sort((left, right) => {
        const leftAt = collectFavoritedAt(left.metadata) || left.createdAt || left.updatedAt
        const rightAt = collectFavoritedAt(right.metadata) || right.createdAt || right.updatedAt
        return new Date(rightAt).getTime() - new Date(leftAt).getTime()
      })
    }
    return next
  }, [items, sortBy])

  if (isLoading) {
    return <QuerySpinner label="正在加载收藏..." />
  }

  if (favorites.length === 0) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--outline-variant))]/60 bg-[hsl(var(--surface-container-low))] px-6 py-16 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10">
          <Star className="h-8 w-8 text-[hsl(var(--primary))]" />
        </div>
        <h3 className="text-xl font-black text-[hsl(var(--on-surface))]">还没有收藏</h3>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-[hsl(var(--secondary))]">
          在生成结果预览里点星星，就能把喜欢的画面或视频收到这里回看。收藏会写进项目资产库，并带上收藏标记。
        </p>
        <div className="mt-6 rounded-full bg-[hsl(var(--surface-container-lowest))] px-4 py-2 text-xs font-medium text-[hsl(var(--primary))]">
          结果预览 → 星标 → 我的收藏
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
        {favorites.map((item) => {
          const mediaType = inferCollectMediaType(item.url, item.metadata)
          const category = collectCategoryLabel(item.metadata?.category)
          const favoritedAt = collectFavoritedAt(item.metadata) || item.createdAt
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item)}
              className="group relative overflow-hidden rounded-xl bg-[hsl(var(--surface-container-lowest))] text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[hsl(var(--on-surface))]/5"
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-[hsl(var(--surface-container-low))]">
                {mediaType === "video" ? (
                  <video
                    src={mediaUrl(item.url)}
                    className="h-full w-full bg-black object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : item.url ? (
                  <img
                    src={mediaUrl(item.url)}
                    alt={item.name || "收藏"}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[hsl(var(--secondary))]">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
                <div className="absolute left-2 top-2 flex items-center gap-1">
                  <span className="rounded-full bg-[hsl(var(--primary))] px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                    {category}
                  </span>
                </div>
                <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--surface-container-lowest))]/90 text-[hsl(var(--primary))]">
                  <Star className="h-3.5 w-3.5 fill-current" />
                </div>
                {mediaType === "video" ? (
                  <div className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-bold text-white">
                    视频
                  </div>
                ) : null}
              </div>
              <div className="p-2.5">
                <h3 className="truncate text-xs font-bold text-[hsl(var(--on-surface))]">
                  {item.name || `收藏 ${item.id}`}
                </h3>
                <p className="mt-1 text-[13px] text-[hsl(var(--secondary))]">{relativeTime(favoritedAt)}</p>
              </div>
            </button>
          )
        })}
      </div>

      <AssetDetailDialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        image={selected ? mediaUrl(selected.url) : undefined}
        mediaType={selected ? inferCollectMediaType(selected.url, selected.metadata) : "image"}
        name={selected?.name || "收藏"}
        badge={<AssetDetailBadge className="bg-[hsl(var(--primary))] text-white">收藏</AssetDetailBadge>}
        metas={
          selected
            ? [
                {
                  icon: <Sparkles className="h-4 w-4" />,
                  label: "分类",
                  value: collectCategoryLabel(selected.metadata?.category),
                },
                {
                  icon:
                    inferCollectMediaType(selected.url, selected.metadata) === "video" ? (
                      <Film className="h-4 w-4" />
                    ) : (
                      <ImageIcon className="h-4 w-4" />
                    ),
                  label: "类型",
                  value: inferCollectMediaType(selected.url, selected.metadata) === "video" ? "视频" : "图片",
                },
                {
                  icon: <Clock className="h-4 w-4" />,
                  label: "收藏时间",
                  value: relativeTime(collectFavoritedAt(selected.metadata) || selected.createdAt),
                },
              ]
            : []
        }
        prompt={selected?.prompt || undefined}
        assetId={selected?.id}
      />
    </div>
  )
}
