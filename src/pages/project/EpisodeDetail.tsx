import { useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Sidebar from "@/components/layout/Sidebar"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { useEffect, useState } from "react"
import { projectApi } from "@/api/projectApi"
import type { Episode } from "@/types"
import {
  ChevronLeft,
  Clapperboard,
  Image as ImageIcon,
  MoveRight,
  Package,
  Sparkles,
  Users,
} from "lucide-react"

const fallbackEpisode = {
  id: 1,
  name: "序章：觉醒",
  code: "EP_001",
  status: "in-progress",
  description: "主角在梦中觉醒超能力，发现隐藏的世界真相。这一集将揭示故事的核心设定，为后续剧情埋下伏笔。",
  progress: 65,
  sceneCount: 12,
  modified: "2 小时前",
}

const relatedCharacters = [
  { id: 1, name: "龙崎真治", role: "主角", image: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=200&h=200&fit=crop" },
  { id: 2, name: "月城雪兔", role: "配角", image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop" },
  { id: 3, name: "神乐千鹤", role: "配角", image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop" },
]

const relatedScenes = [
  { id: 1, name: "赛博街区 7 号扇区", image: "https://images.unsplash.com/photo-1614726365723-49cfae927846?w=300&h=200&fit=crop" },
  { id: 2, name: "黄昏教室 2B", image: "https://images.unsplash.com/photo-1542640244-7e672d6cef4e?w=300&h=200&fit=crop" },
]

const relatedObjects = [
  { id: 1, name: "光子武士刀", type: "武器", image: "https://images.unsplash.com/photo-1589254065878-42c9da997008?w=200&h=200&fit=crop" },
  { id: 2, name: "古董怀表", type: "道具", image: "https://images.unsplash.com/photo-1509048191080-d2984bad6ae5?w=200&h=200&fit=crop" },
]

export default function EpisodeDetail() {
  const { projectId, episodeId } = useParams()
  const navigate = useNavigate()
  const { notify } = useFeedback()
  const [episode, setEpisode] = useState<Episode | null>(null)

  useEffect(() => {
    if (!projectId || !episodeId) return
    void projectApi.episodes.getById(Number(projectId), Number(episodeId)).then((response) => {
      if (response.success) {
        setEpisode(response.data)
      }
    })
  }, [episodeId, projectId])

  const currentEpisode = {
    ...fallbackEpisode,
    ...episode,
    name: (episode?.name as string) || fallbackEpisode.name,
    code: (episode?.code as string) || fallbackEpisode.code,
    status: (episode?.status as string) || fallbackEpisode.status,
    description: (episode?.description as string) || fallbackEpisode.description,
    count: (episode?.count as number) || fallbackEpisode.sceneCount,
    modified: (episode?.modified as string) || fallbackEpisode.modified,
  }

  const openCanvas = () => {
    if (!projectId || !episodeId) return
    navigate(`/project/${projectId}/episode/${episodeId}/canvas`)
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--surface))]">
      <Sidebar />

      <main className="ml-64 min-h-screen bg-[hsl(var(--surface))]">
        <div className="border-b border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface-container-lowest))]">
          <div className="px-8 py-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/project/${projectId}`)}
              className="mb-5 gap-2 text-[hsl(var(--secondary))]"
            >
              <ChevronLeft className="h-4 w-4" />
              返回片段列表
            </Button>

            <div className="flex flex-wrap items-center gap-3">
              <Badge className="border-0 bg-[hsl(var(--surface-container-high))] px-3 py-1 text-[hsl(var(--secondary))]">
                工作台
              </Badge>
              <Badge className="signature-gradient border-0 px-3 py-1 text-white">
                进行中
              </Badge>
            </div>

            <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-[hsl(var(--on-surface))]">
              {currentEpisode.name}
            </h1>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-[hsl(var(--secondary))]">
              <span className="font-mono">{currentEpisode.code}</span>
              <span>{currentEpisode.count} 个场景</span>
              <span>完成度 {fallbackEpisode.progress}%</span>
              <span>修改于 {currentEpisode.modified}</span>
            </div>
          </div>
        </div>

        <div className="px-8 py-8">
          <section className="overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#c53a09_0%,#db5d32_52%,#f08b57_100%)] p-8 text-white shadow-[0_24px_60px_rgba(174,65,21,0.22)]">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4" />
                  本集创作中枢
                </div>
                <h2 className="mt-5 max-w-[10ch] text-5xl font-black leading-[0.96] tracking-[-0.06em]">
                  先进入无限画布，再展开创作
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-7 text-white/85">
                  工作台首页的第一件事，不应该是看详情，而应该是立刻进入编排。无限画布是这集的主入口，角色、场景、道具都围绕它服务。
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Button
                    size="lg"
                    onClick={openCanvas}
                    className="h-14 rounded-full bg-white px-8 text-base font-bold text-[#a22d08] hover:bg-white/92"
                  >
                    <Clapperboard className="mr-2 h-5 w-5" />
                    进入无限画布
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => notify.info("工作流分支功能开发中")}
                    className="h-14 rounded-full border-white/30 bg-white/10 px-8 text-base font-semibold text-white hover:bg-white/16 hover:text-white"
                  >
                    新建分支
                  </Button>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/20 bg-black/10 p-5">
                <div className="text-xs uppercase tracking-[0.24em] text-white/60">Workspace Overview</div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/10 p-4">
                    <div className="text-xs text-white/60">当前片段</div>
                    <div className="mt-2 text-2xl font-black">{currentEpisode.code}</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <div className="text-xs text-white/60">场景数量</div>
                    <div className="mt-2 text-2xl font-black">{currentEpisode.count}</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <div className="text-xs text-white/60">角色素材</div>
                    <div className="mt-2 text-2xl font-black">{relatedCharacters.length}</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <div className="text-xs text-white/60">道具素材</div>
                    <div className="mt-2 text-2xl font-black">{relatedObjects.length}</div>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl bg-white/10 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/70">制作推进</span>
                    <span className="font-bold text-white">{fallbackEpisode.progress}%</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white/15">
                    <div className="h-2 rounded-full bg-white" style={{ width: `${fallbackEpisode.progress}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr_1fr]">
            <div className="rounded-[24px] border border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface-container-low))] p-6">
              <div className="flex items-center gap-2 text-[hsl(var(--secondary))]">
                <Users className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.24em]">登场角色</span>
              </div>
              <div className="mt-5 space-y-3">
                {relatedCharacters.map((char) => (
                  <button
                    key={char.id}
                    onClick={() => notify.info(`查看角色：${char.name}`)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-[hsl(var(--surface-container-high))] p-3 text-left transition-colors hover:bg-[hsl(var(--surface-container-highest))]"
                  >
                    <img src={char.image} alt={char.name} className="h-12 w-12 rounded-xl object-cover" />
                    <div>
                      <div className="text-sm font-bold text-[hsl(var(--on-surface))]">{char.name}</div>
                      <div className="text-xs text-[hsl(var(--secondary))]">{char.role}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface-container-low))] p-6">
              <div className="flex items-center gap-2 text-[hsl(var(--secondary))]">
                <ImageIcon className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.24em]">场景参考</span>
              </div>
              <div className="mt-5 space-y-3">
                {relatedScenes.map((scene) => (
                  <button
                    key={scene.id}
                    onClick={() => notify.info(`查看场景：${scene.name}`)}
                    className="block w-full overflow-hidden rounded-2xl bg-[hsl(var(--surface-container-high))] text-left"
                  >
                    <img src={scene.image} alt={scene.name} className="aspect-[16/9] w-full object-cover" />
                    <div className="p-3 text-sm font-semibold text-[hsl(var(--on-surface))]">{scene.name}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface-container-low))] p-6">
              <div className="flex items-center gap-2 text-[hsl(var(--secondary))]">
                <Package className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.24em]">道具与操作</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {relatedObjects.map((obj) => (
                  <button
                    key={obj.id}
                    onClick={() => notify.info(`查看物品：${obj.name}`)}
                    className="rounded-2xl bg-[hsl(var(--surface-container-high))] p-2 text-left transition-colors hover:bg-[hsl(var(--surface-container-highest))]"
                  >
                    <img src={obj.image} alt={obj.name} className="aspect-square w-full rounded-xl object-cover" />
                    <div className="px-1 pb-1 pt-3">
                      <div className="text-sm font-bold text-[hsl(var(--on-surface))]">{obj.name}</div>
                      <div className="text-xs text-[hsl(var(--secondary))]">{obj.type}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-5 rounded-2xl bg-[hsl(var(--surface-container-high))] p-4">
                <div className="text-sm font-semibold text-[hsl(var(--on-surface))]">本集创作建议</div>
                <p className="mt-2 text-sm leading-6 text-[hsl(var(--secondary))]">
                  先把“觉醒前后”的两个关键场景拖进无限画布，再把主角和核心道具挂上去，镜头关系会更容易展开。
                </p>
                <Button
                  onClick={openCanvas}
                  className="mt-4 h-11 w-full rounded-2xl signature-gradient text-white"
                >
                  打开画布继续
                  <MoveRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
