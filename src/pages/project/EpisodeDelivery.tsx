import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { projectApi } from "@/api/projectApi"
import {
  buildEpisodeDelivery,
  DELIVERY_GAP_LABEL,
  downloadDeliveryManifest,
  type EpisodeDelivery as EpisodeDeliveryManifest,
} from "@/features/project/delivery"
import { mediaUrl } from "@/lib/mediaUrl"
import type { Episode } from "@/types"
import { Clapperboard, Download, Package } from "lucide-react"

interface EpisodeDeliveryProps {
  projectId: number
  episode: Episode
  onOpenStoryboard: () => void
}

export default function EpisodeDelivery({ projectId, episode, onOpenStoryboard }: EpisodeDeliveryProps) {
  const { notify } = useFeedback()
  const [exporting, setExporting] = useState(false)
  const delivery = buildEpisodeDelivery({
    id: episode.id,
    name: episode.name,
    code: episode.code,
    storyboard: episode.storyboard,
  })
  const shotCount = (episode.storyboard || []).length

  const download = async () => {
    setExporting(true)
    const response = await projectApi.episodes.getDelivery(projectId, episode.id)
    const payload: EpisodeDeliveryManifest =
      response.success && response.data
        ? response.data
        : { ...delivery, exportedAt: new Date().toISOString() }
    downloadDeliveryManifest(payload)
    setExporting(false)
    if (response.success) {
      notify.success("已下载交付清单")
      return
    }
    notify.success("已按当前画面下载交付清单")
  }

  return (
    <section className="rounded-[24px] border border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface-container-lowest))] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-[hsl(var(--secondary))]">
            <Package className="h-4 w-4" />
            <span className="text-[13px] font-semibold">剪辑领取</span>
          </div>
          <h2 className="mt-2 text-2xl font-black text-[hsl(var(--on-surface))]">本集交付</h2>
          <p className="mt-2 text-sm leading-6 text-[hsl(var(--secondary))]">
            分镜表里点过「定稿」的镜头，按镜号排进这一包。未定稿的镜头不进包，单独列在下面的缺口里。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-3 rounded-2xl bg-[hsl(var(--surface-container-low))] px-4 py-3">
            <div>
              <div className="font-mono text-2xl font-black text-[hsl(var(--on-surface))]">{delivery.items.length}</div>
              <div className="text-xs text-[hsl(var(--secondary))]">进包</div>
            </div>
            <div className="w-px bg-[hsl(var(--outline-variant))]/40" />
            <div>
              <div className="font-mono text-2xl font-black text-[hsl(var(--on-surface))]">{delivery.gaps.length}</div>
              <div className="text-xs text-[hsl(var(--secondary))]">缺口</div>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => void download()}
            disabled={exporting}
            className="h-11 rounded-xl border-0 signature-gradient px-5 text-white"
          >
            <Download className="mr-1.5 h-4 w-4" />
            {exporting ? "正在导出…" : "下载交付清单"}
          </Button>
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-[hsl(var(--on-surface-variant))]">{delivery.export.note}</p>

      {shotCount === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl bg-[hsl(var(--surface-container-low))] px-6 py-16 text-center">
          <Clapperboard className="mb-4 h-10 w-10 text-[hsl(var(--primary))]" />
          <p className="text-sm text-[hsl(var(--on-surface))]">这一集还没有分镜</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-[hsl(var(--secondary))]">
            先在分镜表里排好镜号并生成首帧，再把要用的镜头定稿。定稿之后会出现在这里。
          </p>
          <Button
            type="button"
            onClick={onOpenStoryboard}
            className="mt-5 h-11 rounded-xl border-0 signature-gradient px-6 text-white"
          >
            去分镜表
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          <div>
            <h3 className="text-sm font-semibold text-[hsl(var(--on-surface))]">交付顺序</h3>
            <p className="mt-1 text-sm text-[hsl(var(--secondary))]">只含已定稿镜头，文件名带镜号。</p>
            {delivery.items.length === 0 ? (
              <div className="mt-3 rounded-2xl bg-[hsl(var(--surface-container-low))] px-5 py-8 text-center">
                <p className="text-sm text-[hsl(var(--on-surface))]">还没有镜头定稿</p>
                <p className="mt-2 text-sm text-[hsl(var(--secondary))]">缺口里的镜头不会进入清单。</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onOpenStoryboard}
                  className="mt-4 h-10 rounded-xl border-[hsl(var(--outline-variant))]/40"
                >
                  去分镜表定稿
                </Button>
              </div>
            ) : (
              <ol className="mt-3 space-y-3">
                {delivery.items.map((item) => (
                  <li
                    key={item.shotId}
                    className="grid gap-4 rounded-2xl bg-[hsl(var(--surface-container-low))] p-3 sm:grid-cols-[168px_minmax(0,1fr)]"
                  >
                    <div className="relative aspect-video overflow-hidden rounded-xl bg-[hsl(var(--surface-container-high))]">
                      <img src={mediaUrl(item.fileUrl)} alt="" className="h-full w-full object-cover" />
                      <span className="absolute left-2 top-2 rounded-md bg-[hsl(var(--on-surface))]/75 px-1.5 py-0.5 font-mono text-xs font-bold text-[hsl(var(--surface-container-lowest))]">
                        {String(item.shotNumber).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-col justify-between gap-3 py-1 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold text-[hsl(var(--on-surface))]">
                            镜 {String(item.shotNumber).padStart(2, "0")}
                          </span>
                          <Badge className="border-0 bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))]">已定稿</Badge>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[hsl(var(--on-surface))]">
                          {item.prompt || "这一镜没有画面说明"}
                        </p>
                        <p className="mt-1 truncate font-mono text-xs text-[hsl(var(--secondary))]">{item.filename}</p>
                      </div>
                      <a
                        href={mediaUrl(item.fileUrl)}
                        download={item.filename}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--surface-container-lowest))] px-4 text-sm font-medium text-[hsl(var(--on-surface))]"
                      >
                        打开文件
                      </a>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {delivery.gaps.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-[hsl(var(--on-surface))]">未进包的缺口</h3>
              <p className="mt-1 text-sm text-[hsl(var(--secondary))]">这些镜号还不能交给剪辑。</p>
              <ul className="mt-3 space-y-2">
                {delivery.gaps.map((gap) => (
                  <li
                    key={gap.shotId}
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-[hsl(var(--outline-variant))]/60 px-4 py-3"
                  >
                    <span className="font-mono text-sm font-bold text-[hsl(var(--on-surface))]">
                      {String(gap.shotNumber).padStart(2, "0")}
                    </span>
                    <Badge className="border-0 bg-[hsl(var(--surface-container-high))] text-[hsl(var(--on-surface-variant))]">
                      {DELIVERY_GAP_LABEL[gap.reason]}
                    </Badge>
                    <p className="min-w-0 flex-1 truncate text-sm text-[hsl(var(--secondary))]">
                      {gap.prompt || "空白镜头"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
