import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { persistMedia } from "@/api/aigc/imageService"
import { generateAssetImage } from "@/lib/generateAssetImage"
import { useImageModels } from "@/features/infinite-canvas/hooks/useModels"
import {
  buildShotPrompt,
  collectShotReferenceImages,
  createStoryboardShot,
  persistableStoryboard,
  pickStoryboardModel,
  resolveShotSceneId,
  shotsFromEpisodeScript,
  storyboardSceneChoices,
  STORYBOARD_STATUS_LABEL,
  storyboardUsesReferenceImages,
} from "@/features/project/storyboard"
import { evaluateStoryboardGate, foreignShotSceneNames, storyboardDependencyAssets } from "@/features/project/shaping"
import { useProjectStore } from "@/store/projectStore"
import type { Character, Episode, ObjectItem, Scene, StoryboardShot } from "@/types"
import { ChevronDown, ChevronUp, Clapperboard, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react"

interface EpisodeStoryboardProps {
  projectId: number
  episode: Episode
  characters: Character[]
  scenes: Scene[]
  objects?: ObjectItem[]
  onEpisodeChange: (episode: Episode) => void
}

const STATUS_CLASS: Record<StoryboardShot["status"], string> = {
  empty: "bg-[hsl(var(--surface-container-high))] text-[hsl(var(--on-surface-variant))]",
  generating: "bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))]",
  ready: "bg-emerald-500/12 text-emerald-700",
  failed: "bg-red-500/10 text-red-600",
}

export default function EpisodeStoryboard({
  projectId,
  episode,
  characters,
  scenes,
  objects = [],
  onEpisodeChange,
}: EpisodeStoryboardProps) {
  const { notify } = useFeedback()
  const updateEpisode = useProjectStore((state) => state.updateEpisode)
  const { models: imageModels } = useImageModels()
  const [shots, setShots] = useState<StoryboardShot[]>(() => episode.storyboard || [])
  const shotsRef = useRef(shots)
  const saveTimer = useRef<number>()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    shotsRef.current = shots
  }, [shots])

  useEffect(() => {
    setShots(episode.storyboard || [])
  }, [episode.id])

  const catalog = useMemo(() => ({ characters, scenes, objects }), [characters, objects, scenes])
  const episodeSceneIds = useMemo(() => episode.sceneIds || [], [episode.sceneIds])
  const sceneChoices = useMemo(
    () => storyboardSceneChoices(scenes, episodeSceneIds),
    [episodeSceneIds, scenes]
  )
  const foreignScenes = useMemo(
    () =>
      foreignShotSceneNames({
        episodeSceneIds,
        shots,
        scenes,
      }),
    [episodeSceneIds, scenes, shots]
  )
  const gate = useMemo(
    () =>
      evaluateStoryboardGate(
        storyboardDependencyAssets({
          episodeCharacterIds: episode.characterIds,
          episodeSceneIds,
          episodeObjectIds: episode.objectIds,
          shots,
          characters,
          scenes,
          objects,
        })
      ),
    [characters, episode.characterIds, episode.objectIds, episodeSceneIds, objects, scenes, shots]
  )
  const modelIds = imageModels.map((model) => model.id)
  const busy = shots.some((shot) => shot.status === "generating")

  const persistShots = useCallback(
    async (next: StoryboardShot[]) => {
      setSaving(true)
      const saved = await updateEpisode(projectId, episode.id, {
        storyboard: persistableStoryboard(next),
      })
      setSaving(false)
      if (!saved) {
        notify.error(useProjectStore.getState().error || "分镜表保存失败")
        return
      }
      onEpisodeChange(saved)
    },
    [episode.id, notify, onEpisodeChange, projectId, updateEpisode]
  )

  const schedulePersist = useCallback(
    (next: StoryboardShot[]) => {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        void persistShots(next)
      }, 500)
    },
    [persistShots]
  )

  useEffect(() => () => window.clearTimeout(saveTimer.current), [])

  const commit = (updater: (current: StoryboardShot[]) => StoryboardShot[], persist: "now" | "later" | "none" = "now") => {
    const next = updater(shotsRef.current).map((shot, index) => ({ ...shot, index: index + 1 }))
    shotsRef.current = next
    setShots(next)
    if (persist === "now") void persistShots(next)
    if (persist === "later") schedulePersist(next)
  }

  const addShot = (prompt = "") => {
    const sceneId = resolveShotSceneId(prompt, scenes, episodeSceneIds)
    commit((current) => [...current, { ...createStoryboardShot(current.length + 1, prompt), sceneId }])
  }

  const splitFromScript = () => {
    const next = shotsFromEpisodeScript(episode.description || "", {
      ...catalog,
      episodeSceneIds,
    })
    if (!next.length) {
      notify.warning("本集还没有可拆的剧情")
      return
    }
    commit(() => next)
    notify.success(`已拆成 ${next.length} 个分镜`)
  }

  const generateShot = async (shotId: string) => {
    const shot = shotsRef.current.find((item) => item.id === shotId)
    if (!shot) return
    if (gate.blocked) {
      notify.warning(gate.blockedMessage || "先锁定提示词或定妆")
      return
    }
    if (!shot.prompt.trim()) {
      notify.warning("请先填写画面说明")
      return
    }
    const refs = collectShotReferenceImages(shot, catalog)
    const model = pickStoryboardModel(refs.length > 0, modelIds)
    const prompt = buildShotPrompt(shot, catalog)
    commit(
      (current) =>
        current.map((item) =>
          item.id === shotId ? { ...item, status: "generating", error: undefined } : item
        ),
      "none"
    )
    try {
      const urls = await generateAssetImage({
        model,
        prompt,
        aspectRatio: "16:9",
        n: 1,
        referenceImages: storyboardUsesReferenceImages(model) ? refs : undefined,
      })
      const rawUrl = urls[0]
      if (!rawUrl) throw new Error("未返回首帧")
      const imageUrl = await persistMedia(rawUrl).catch(() => rawUrl)
      commit((current) =>
        current.map((item) =>
          item.id === shotId ? { ...item, imageUrl, status: "ready", error: undefined } : item
        )
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成失败"
      commit((current) =>
        current.map((item) =>
          item.id === shotId ? { ...item, status: "failed", error: message } : item
        )
      )
      notify.error(message)
    }
  }

  return (
    <section className="rounded-[24px] border border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface-container-lowest))] p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-[hsl(var(--on-surface))]">分镜表</h3>
          <p className="mt-1 text-sm text-[hsl(var(--secondary))]">
            一行一镜。已定妆的角色、场景和道具会带定妆图；半定型只写入锁定的提示词。参考图仅在图生图模型（wan2.6-image）生效。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {saving ? <span className="text-xs text-[hsl(var(--secondary))]">保存中…</span> : null}
          {episode.description ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={splitFromScript}
              className="h-10 rounded-xl border-[hsl(var(--outline-variant))]/40"
            >
              从本集剧本拆成行
            </Button>
          ) : null}
          <Button onClick={() => addShot()} className="h-10 rounded-xl signature-gradient border-0 text-white">
            <Plus className="mr-1 h-4 w-4" />
            添加分镜
          </Button>
        </div>
      </div>

      {gate.blockedMessage ? (
        <div className="mb-4 rounded-xl bg-[hsl(var(--surface-container-high))] px-4 py-3 text-sm text-[hsl(var(--on-surface))]">
          {gate.blockedMessage}
        </div>
      ) : null}
      {foreignScenes.length ? (
        <div className="mb-4 rounded-xl bg-[hsl(var(--primary))]/10 px-4 py-3 text-sm text-[hsl(var(--primary))]">
          引用了其他集的场景：{foreignScenes.join("、")}
        </div>
      ) : null}
      {gate.semiHint ? (
        <div className="mb-4 rounded-xl bg-[hsl(var(--primary))]/10 px-4 py-3 text-sm text-[hsl(var(--primary))]">
          {gate.semiHint}
        </div>
      ) : null}

      {shots.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-[hsl(var(--surface-container-low))] px-6 py-16 text-center">
          <Clapperboard className="mb-4 h-10 w-10 text-[hsl(var(--primary))]" />
          <p className="text-sm text-[hsl(var(--on-surface-variant))]">为本集添加分镜，或从剧本拆行</p>
          <Button onClick={() => addShot()} className="mt-5 h-11 rounded-xl signature-gradient border-0 px-6 text-white">
            <Plus className="mr-1 h-4 w-4" />
            添加分镜
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-[12px] font-semibold text-[hsl(var(--secondary))]">
                <th className="w-16 px-2">镜号</th>
                <th className="px-2">画面说明</th>
                <th className="w-40 px-2">关联角色</th>
                <th className="w-36 px-2">关联场景</th>
                <th className="w-28 px-2">首帧预览</th>
                <th className="w-20 px-2">状态</th>
                <th className="w-40 px-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {shots.map((shot, index) => {
                const characterNames = characters.filter((item) => shot.characterIds.includes(item.id))
                const scene = scenes.find((item) => item.id === shot.sceneId)
                const sceneFromOtherEpisode = Boolean(scene && !episodeSceneIds.includes(scene.id))
                return (
                  <tr key={shot.id} className="align-top">
                    <td className="px-2 py-2">
                      <div className="flex h-full flex-col items-center gap-1 pt-2">
                        <span className="font-mono text-sm font-bold text-[hsl(var(--on-surface))]">
                          {String(shot.index).padStart(2, "0")}
                        </span>
                        <div className="flex flex-col">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() =>
                              commit((current) => {
                                const next = [...current]
                                ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                                return next
                              })
                            }
                            className="text-[hsl(var(--secondary))] disabled:opacity-30"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={index === shots.length - 1}
                            onClick={() =>
                              commit((current) => {
                                const next = [...current]
                                ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
                                return next
                              })
                            }
                            className="text-[hsl(var(--secondary))] disabled:opacity-30"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <Textarea
                        value={shot.prompt}
                        onChange={(event) =>
                          commit(
                            (current) =>
                              current.map((item) =>
                                item.id === shot.id ? { ...item, prompt: event.target.value } : item
                              ),
                            "later"
                          )
                        }
                        placeholder="这一镜看见什么、谁在做什么"
                        className="min-h-[88px] rounded-xl border-none bg-[hsl(var(--surface-container-low))] text-sm placeholder:text-[hsl(var(--secondary))] focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))]"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-auto min-h-11 w-full justify-between rounded-xl bg-[hsl(var(--surface-container-low))] px-3 text-left text-sm font-normal hover:bg-[hsl(var(--surface-container-high))]"
                          >
                            <span className={characterNames.length ? "text-[hsl(var(--on-surface))]" : "text-[hsl(var(--secondary))]"}>
                              {characterNames.length ? characterNames.map((item) => item.name).join("、") : "选择角色"}
                            </span>
                            <ChevronDown className="h-4 w-4 shrink-0 text-[hsl(var(--secondary))]" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-64 w-56 overflow-y-auto">
                          {characters.length === 0 ? (
                            <DropdownMenuItem disabled>项目里还没有角色</DropdownMenuItem>
                          ) : (
                            characters.map((item) => (
                              <DropdownMenuCheckboxItem
                                key={item.id}
                                checked={shot.characterIds.includes(item.id)}
                                onCheckedChange={() =>
                                  commit(
                                    (current) =>
                                      current.map((row) =>
                                        row.id === shot.id
                                          ? {
                                              ...row,
                                              characterIds: row.characterIds.includes(item.id)
                                                ? row.characterIds.filter((id) => id !== item.id)
                                                : [...row.characterIds, item.id],
                                          }
                                          : row
                                      ),
                                    "later"
                                  )
                                }
                                onSelect={(event) => event.preventDefault()}
                              >
                                {item.name}
                              </DropdownMenuCheckboxItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                    <td className="px-2 py-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-11 w-full justify-between rounded-xl bg-[hsl(var(--surface-container-low))] px-3 text-left text-sm font-normal hover:bg-[hsl(var(--surface-container-high))]"
                          >
                            <span className={scene ? "text-[hsl(var(--on-surface))]" : "text-[hsl(var(--secondary))]"}>
                              {scene ? (sceneFromOtherEpisode ? `${scene.name} · 其他集` : scene.name) : "选择场景"}
                            </span>
                            <ChevronDown className="h-4 w-4 shrink-0 text-[hsl(var(--secondary))]" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-64 w-56 overflow-y-auto">
                          <DropdownMenuItem
                            onClick={() =>
                              commit(
                                (current) =>
                                  current.map((row) => (row.id === shot.id ? { ...row, sceneId: null } : row)),
                                "later"
                              )
                            }
                          >
                            不关联
                          </DropdownMenuItem>
                          {sceneChoices.length === 0 ? (
                            <DropdownMenuItem disabled>本集还没有关联场景</DropdownMenuItem>
                          ) : (
                            sceneChoices.map((item) => (
                              <DropdownMenuItem
                                key={item.id}
                                onClick={() =>
                                  commit(
                                    (current) =>
                                      current.map((row) => (row.id === shot.id ? { ...row, sceneId: item.id } : row)),
                                    "later"
                                  )
                                }
                              >
                                {item.name}
                              </DropdownMenuItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex h-16 w-24 items-center justify-center overflow-hidden rounded-xl bg-[hsl(var(--surface-container-low))]">
                        {shot.imageUrl ? (
                          <img src={shot.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Sparkles className="h-4 w-4 text-[hsl(var(--secondary))]" />
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <Badge className={`border-0 ${STATUS_CLASS[shot.status]}`}>
                        {STORYBOARD_STATUS_LABEL[shot.status]}
                      </Badge>
                      {shot.status === "failed" && shot.error ? (
                        <p className="mt-1 line-clamp-2 text-[11px] text-red-500">{shot.error}</p>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          disabled={shot.status === "generating" || gate.blocked}
                          title={gate.blockedMessage || undefined}
                          onClick={() => void generateShot(shot.id)}
                          className={`h-9 rounded-lg border-0 disabled:cursor-not-allowed ${
                            gate.blocked
                              ? "bg-[hsl(var(--surface-container-highest))] text-[hsl(var(--on-surface-variant))]"
                              : "signature-gradient text-white"
                          }`}
                        >
                          {shot.imageUrl ? (
                            <>
                              <RefreshCw className="mr-1 h-3.5 w-3.5" />
                              重新生成
                            </>
                          ) : (
                            "生成首帧"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={shot.status === "generating"}
                          onClick={() => commit((current) => current.filter((item) => item.id !== shot.id))}
                          className="h-8 text-[hsl(var(--secondary))] hover:text-red-600"
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          删除
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
