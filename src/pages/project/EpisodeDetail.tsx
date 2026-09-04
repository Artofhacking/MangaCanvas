import { useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Sidebar from "@/components/layout/Sidebar"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { useEffect, useMemo, useState } from "react"
import { projectApi } from "@/api/projectApi"
import { useWorkflowLauncher } from "@/hooks/useWorkflowLauncher"
import type { Character, Episode, EpisodeRelationItem, ObjectItem, Scene } from "@/types"
import {
  ChevronLeft,
  Clapperboard,
  Image as ImageIcon,
  MoveRight,
  Package,
  Sparkles,
  Users,
} from "lucide-react"

export default function EpisodeDetail() {
  const { projectId, episodeId } = useParams()
  const navigate = useNavigate()
  const { notify } = useFeedback()
  const launchWorkflow = useWorkflowLauncher()
  const [episode, setEpisode] = useState<Episode | null>(null)
  const [catalog, setCatalog] = useState<{ characters: Character[]; scenes: Scene[]; objects: ObjectItem[] }>({
    characters: [],
    scenes: [],
    objects: [],
  })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<{ characterIds: number[]; sceneIds: number[]; objectIds: number[] }>({
    characterIds: [],
    sceneIds: [],
    objectIds: [],
  })

  const reload = async () => {
    if (!projectId || !episodeId) return
    const [episodeResponse, characters, scenes, objects] = await Promise.all([
      projectApi.episodes.getById(Number(projectId), Number(episodeId)),
      projectApi.characters.getAll(Number(projectId)),
      projectApi.scenes.getAll(Number(projectId)),
      projectApi.objects.getAll(Number(projectId)),
    ])
    if (!episodeResponse.success || !episodeResponse.data) {
      notify.error(episodeResponse.message || "片段不存在")
      navigate(`/project/${projectId}/episodes`, { replace: true })
      return
    }
    setEpisode(episodeResponse.data)
    setDraft({
      characterIds: episodeResponse.data.characterIds || [],
      sceneIds: episodeResponse.data.sceneIds || [],
      objectIds: episodeResponse.data.objectIds || [],
    })
    setCatalog({
      characters: characters.data || [],
      scenes: scenes.data || [],
      objects: objects.data || [],
    })
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId, projectId])

  const relatedCharacters = episode?.characters || []
  const relatedScenes = episode?.scenes || []
  const relatedObjects = episode?.objects || []

  const openCanvas = async () => {
    if (!projectId || !episodeId || !episode) return
    await launchWorkflow({
      projectId,
      sourceType: "episode",
      sourceName: episode.name,
      sourceAssetId: Number(episodeId),
      seedPrompt: episode.description,
      relatedAssets: [
        ...relatedCharacters.map((item) => ({
          id: item.id,
          name: item.name,
          image: item.image,
          category: "character" as const,
        })),
        ...relatedScenes.map((item) => ({
          id: item.id,
          name: item.name,
          image: item.image,
          category: "scene" as const,
        })),
        ...relatedObjects.map((item) => ({
          id: item.id,
          name: item.name,
          image: item.image,
          category: "object" as const,
        })),
      ],
    })
  }

  const saveRelations = async () => {
    if (!projectId || !episodeId) return
    const response = await projectApi.episodes.updateRelations(Number(projectId), Number(episodeId), draft)
    if (!response.success || !response.data) {
      notify.error(response.message || "保存关联失败")
      return
    }
    setEpisode(response.data)
    setEditing(false)
    notify.success("片段关联已更新")
  }

  const toggleId = (key: "characterIds" | "sceneIds" | "objectIds", id: number) => {
    setDraft((prev) => ({
      ...prev,
      [key]: prev[key].includes(id) ? prev[key].filter((item) => item !== id) : [...prev[key], id],
    }))
  }

  const progress = episode?.progress ?? 0
  const relationPreview = useMemo(
    () => ({
      characters: relatedCharacters as EpisodeRelationItem[],
      scenes: relatedScenes as EpisodeRelationItem[],
      objects: relatedObjects as EpisodeRelationItem[],
    }),
    [relatedCharacters, relatedObjects, relatedScenes]
  )

  if (!episode) return null

  return (
    <div className="min-h-screen bg-[hsl(var(--surface))]">
      <Sidebar />

      <main className="ml-64 min-h-screen bg-[hsl(var(--surface))]">
        <div className="border-b border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface-container-lowest))]">
          <div className="px-8 py-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/project/${projectId}/episodes`)}
              className="mb-5 gap-2 text-[hsl(var(--secondary))]"
            >
              <ChevronLeft className="h-4 w-4" />
              返回片段列表
            </Button>

            <div className="flex flex-wrap items-center gap-3">
              <Badge className="border-0 bg-[hsl(var(--surface-container-high))] px-3 py-1 text-[hsl(var(--secondary))]">
                片段
              </Badge>
              <Badge className="signature-gradient border-0 px-3 py-1 text-white">
                {episode.status === "completed" ? "已完成" : episode.status === "draft" ? "草稿" : "进行中"}
              </Badge>
            </div>

            <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-[hsl(var(--on-surface))]">
              {episode.name}
            </h1>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-[hsl(var(--secondary))]">
              <span className="font-mono">{episode.code}</span>
              <span>{episode.count} 个场景</span>
              <span>完成度 {progress}%</span>
              <span>修改于 {episode.modified}</span>
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
                <h2 className="mt-5 max-w-[12ch] text-5xl font-black leading-[0.96] tracking-[-0.06em]">
                  用本集资产进入无限画布
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-7 text-white/85">
                  {episode.description || "先把角色、场景和道具挂到这一集，再进入画布生成和回写素材。"}
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Button
                    size="lg"
                    onClick={() => void openCanvas()}
                    className="h-14 rounded-full bg-white px-8 text-base font-bold text-[#a22d08] hover:bg-white/92"
                  >
                    <Clapperboard className="mr-2 h-5 w-5" />
                    进入无限画布
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => setEditing((value) => !value)}
                    className="h-14 rounded-full border-white/30 bg-white/10 px-8 text-base font-semibold text-white hover:bg-white/16 hover:text-white"
                  >
                    {editing ? "取消编辑" : "编辑关联"}
                  </Button>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/20 bg-black/10 p-5">
                <div className="text-xs uppercase tracking-[0.24em] text-white/60">Workspace Overview</div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/10 p-4">
                    <div className="text-xs text-white/60">当前片段</div>
                    <div className="mt-2 text-2xl font-black">{episode.code}</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <div className="text-xs text-white/60">场景数量</div>
                    <div className="mt-2 text-2xl font-black">{relationPreview.scenes.length}</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <div className="text-xs text-white/60">角色素材</div>
                    <div className="mt-2 text-2xl font-black">{relationPreview.characters.length}</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <div className="text-xs text-white/60">道具素材</div>
                    <div className="mt-2 text-2xl font-black">{relationPreview.objects.length}</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {editing ? (
            <section className="mt-6 rounded-[24px] border border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface-container-lowest))] p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-[hsl(var(--on-surface))]">选择本集关联资产</h3>
                <Button onClick={() => void saveRelations()} className="signature-gradient rounded-xl border-0 text-white">
                  保存关联
                </Button>
              </div>
              <div className="grid gap-6 lg:grid-cols-3">
                <div>
                  <div className="mb-3 text-sm font-semibold text-[hsl(var(--secondary))]">角色</div>
                  <div className="space-y-2">
                    {catalog.characters.map((item) => (
                      <label key={item.id} className="flex items-center gap-3 rounded-xl bg-[hsl(var(--surface-container-low))] p-3">
                        <input
                          type="checkbox"
                          checked={draft.characterIds.includes(item.id)}
                          onChange={() => toggleId("characterIds", item.id)}
                        />
                        <img src={item.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        <span className="text-sm font-medium">{item.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-3 text-sm font-semibold text-[hsl(var(--secondary))]">场景</div>
                  <div className="space-y-2">
                    {catalog.scenes.map((item) => (
                      <label key={item.id} className="flex items-center gap-3 rounded-xl bg-[hsl(var(--surface-container-low))] p-3">
                        <input
                          type="checkbox"
                          checked={draft.sceneIds.includes(item.id)}
                          onChange={() => toggleId("sceneIds", item.id)}
                        />
                        <img src={item.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        <span className="text-sm font-medium">{item.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-3 text-sm font-semibold text-[hsl(var(--secondary))]">物品</div>
                  <div className="space-y-2">
                    {catalog.objects.map((item) => (
                      <label key={item.id} className="flex items-center gap-3 rounded-xl bg-[hsl(var(--surface-container-low))] p-3">
                        <input
                          type="checkbox"
                          checked={draft.objectIds.includes(item.id)}
                          onChange={() => toggleId("objectIds", item.id)}
                        />
                        <img src={item.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        <span className="text-sm font-medium">{item.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr_1fr]">
            <div className="rounded-[24px] border border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface-container-low))] p-6">
              <div className="flex items-center gap-2 text-[hsl(var(--secondary))]">
                <Users className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.24em]">登场角色</span>
              </div>
              <div className="mt-5 space-y-3">
                {relationPreview.characters.length === 0 ? (
                  <p className="text-sm text-[hsl(var(--secondary))]">还没有关联角色</p>
                ) : (
                  relationPreview.characters.map((char) => (
                    <button
                      key={char.id}
                      onClick={() =>
                        projectId &&
                        void launchWorkflow({
                          projectId,
                          sourceType: "character",
                          sourceName: char.name,
                          sourceAssetId: char.id,
                          seedImage: char.image,
                        })
                      }
                      className="flex w-full items-center gap-3 rounded-2xl bg-[hsl(var(--surface-container-high))] p-3 text-left transition-colors hover:bg-[hsl(var(--surface-container-highest))]"
                    >
                      <img src={char.image} alt={char.name} className="h-12 w-12 rounded-xl object-cover" />
                      <div>
                        <div className="text-sm font-bold text-[hsl(var(--on-surface))]">{char.name}</div>
                        <div className="text-xs text-[hsl(var(--secondary))]">{char.role}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface-container-low))] p-6">
              <div className="flex items-center gap-2 text-[hsl(var(--secondary))]">
                <ImageIcon className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.24em]">场景参考</span>
              </div>
              <div className="mt-5 space-y-3">
                {relationPreview.scenes.length === 0 ? (
                  <p className="text-sm text-[hsl(var(--secondary))]">还没有关联场景</p>
                ) : (
                  relationPreview.scenes.map((scene) => (
                    <button
                      key={scene.id}
                      onClick={() =>
                        projectId &&
                        void launchWorkflow({
                          projectId,
                          sourceType: "scene",
                          sourceName: scene.name,
                          sourceAssetId: scene.id,
                          seedImage: scene.image,
                        })
                      }
                      className="block w-full overflow-hidden rounded-2xl bg-[hsl(var(--surface-container-high))] text-left"
                    >
                      {scene.image ? (
                        <img src={scene.image} alt={scene.name} className="aspect-[16/9] w-full object-cover" />
                      ) : null}
                      <div className="p-3 text-sm font-semibold text-[hsl(var(--on-surface))]">{scene.name}</div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface-container-low))] p-6">
              <div className="flex items-center gap-2 text-[hsl(var(--secondary))]">
                <Package className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.24em]">道具与操作</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {relationPreview.objects.length === 0 ? (
                  <p className="col-span-2 text-sm text-[hsl(var(--secondary))]">还没有关联物品</p>
                ) : (
                  relationPreview.objects.map((obj) => (
                    <button
                      key={obj.id}
                      onClick={() =>
                        projectId &&
                        void launchWorkflow({
                          projectId,
                          sourceType: "object",
                          sourceName: obj.name,
                          sourceAssetId: obj.id,
                          seedImage: obj.image,
                        })
                      }
                      className="rounded-2xl bg-[hsl(var(--surface-container-high))] p-2 text-left transition-colors hover:bg-[hsl(var(--surface-container-highest))]"
                    >
                      {obj.image ? (
                        <img src={obj.image} alt={obj.name} className="aspect-square w-full rounded-xl object-cover" />
                      ) : null}
                      <div className="px-1 pb-1 pt-3">
                        <div className="text-sm font-bold text-[hsl(var(--on-surface))]">{obj.name}</div>
                        <div className="text-xs text-[hsl(var(--secondary))]">{obj.type}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="mt-5 rounded-2xl bg-[hsl(var(--surface-container-high))] p-4">
                <div className="text-sm font-semibold text-[hsl(var(--on-surface))]">本集创作建议</div>
                <p className="mt-2 text-sm leading-6 text-[hsl(var(--secondary))]">
                  先确认本集角色、场景和道具，再进入画布生成，最后把结果保存回素材库。
                </p>
                <Button
                  onClick={() => void openCanvas()}
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
