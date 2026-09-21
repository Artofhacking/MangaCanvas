import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  Box,
  Check,
  Clapperboard,
  FileText,
  Image,
  Loader2,
  ScrollText,
  Sparkles,
  Upload,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import WorkspaceHeader from "@/components/layout/WorkspaceHeader"
import WorkspaceLayout from "@/components/layout/WorkspaceLayout"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import {
  scriptsApi,
  type ScriptCharacterDraft,
  type ScriptDocument,
  type ScriptEpisodeDraft,
  type ScriptPropDraft,
  type ScriptSceneDraft,
} from "@/features/project/api/scripts"
import { formatScriptImportToast } from "@/features/project/scriptImport"
import { getActiveProjectId } from "@/lib/session"
import { projectAssetsPath } from "@/lib/workspaceRoutes"
import { useCreditQuote } from "@/hooks/useCreditQuote"

const ACCEPT_EXT = [".txt", ".md"]
const MAX_FILE_BYTES = 2 * 1024 * 1024

const AGENT_STEPS = [
  "读取剧本原文",
  "提炼剧情主线",
  "按情节拆分集数",
  "抽取人物、场景与道具",
]

type ResultTab = "plot" | "episodes" | "scenes" | "props" | "characters"

const RESULT_TABS: { id: ResultTab; label: string }[] = [
  { id: "plot", label: "剧情" },
  { id: "episodes", label: "分集" },
  { id: "scenes", label: "场景" },
  { id: "props", label: "道具" },
  { id: "characters", label: "人物" },
]

const ROLE_LABEL: Record<string, string> = { main: "主角", support: "配角" }
const GENDER_LABEL: Record<string, string> = { male: "男", female: "女", other: "其他" }
const AGE_LABEL: Record<string, string> = {
  child: "儿童",
  teen: "少年",
  young: "青年",
  middle: "中年",
  old: "老年",
}
const PROP_LABEL: Record<string, string> = {
  weapon: "武器",
  prop: "道具",
  clothing: "服装",
  decoration: "场景装饰",
}

function itemKey(kind: string, name: string, index: number) {
  return `${kind}:${name || index}`
}

function readTextFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("文件读取失败"))
    reader.readAsText(file, "utf-8")
  })
}

export default function ScriptStudio() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { notify } = useFeedback()
  const projectId = Number(id || getActiveProjectId() || 0)
  const { costLabel, blocked } = useCreditQuote(
    projectId
      ? { model: "qwen-plus", modality: "text", unit: "script_parse", projectId }
      : null
  )

  const [sourceText, setSourceText] = useState("")
  const [filename, setFilename] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [resultTab, setResultTab] = useState<ResultTab>("plot")
  const [document, setDocument] = useState<ScriptDocument | null>(null)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!projectId) {
      navigate("/dashboard", { replace: true })
    }
  }, [projectId, navigate])

  useEffect(() => {
    if (!parsing) {
      setActiveStep(0)
      return
    }
    setActiveStep(0)
    const timer = window.setInterval(() => {
      setActiveStep((current) => Math.min(current + 1, AGENT_STEPS.length - 1))
    }, 1400)
    return () => window.clearInterval(timer)
  }, [parsing])

  const applyFile = useCallback(
    async (file: File) => {
      const lower = file.name.toLowerCase()
      if (!ACCEPT_EXT.some((ext) => lower.endsWith(ext))) {
        notify.warning("仅支持 txt、md 文件")
        return
      }
      if (file.size > MAX_FILE_BYTES) {
        notify.warning("文件不能超过 2MB")
        return
      }
      const text = await readTextFile(file)
      if (!text.trim()) {
        notify.warning("文件内容为空")
        return
      }
      setFilename(file.name)
      setSourceText(text)
      setTitle(file.name.replace(/\.(txt|md)$/i, ""))
      notify.success(`已载入 ${file.name}`)
    },
    [notify]
  )

  const handleDrop = async (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) await applyFile(file)
  }

  const toggleExcluded = (key: string) => {
    setExcluded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectedCharacters = useMemo(
    () =>
      (document?.characters || []).filter(
        (item, index) => !excluded.has(itemKey("character", item.name, index))
      ),
    [document, excluded]
  )
  const selectedScenes = useMemo(
    () =>
      (document?.scenes || []).filter((item, index) => !excluded.has(itemKey("scene", item.name, index))),
    [document, excluded]
  )
  const selectedProps = useMemo(
    () =>
      (document?.props || []).filter((item, index) => !excluded.has(itemKey("prop", item.name, index))),
    [document, excluded]
  )
  const selectedEpisodes = useMemo(
    () =>
      (document?.episodes || []).filter(
        (item, index) => !excluded.has(itemKey("episode", item.name, index))
      ),
    [document, excluded]
  )

  const importDocument = useCallback(
    async (
      doc: ScriptDocument,
      payload: {
        characters: ScriptCharacterDraft[]
        scenes: ScriptSceneDraft[]
        props: ScriptPropDraft[]
        episodes: ScriptEpisodeDraft[]
      },
      options?: { auto?: boolean }
    ) => {
      if (
        payload.characters.length +
          payload.scenes.length +
          payload.props.length +
          payload.episodes.length ===
        0
      ) {
        notify.warning("请至少保留一项再写入项目")
        return false
      }
      setImporting(true)
      try {
        const response = await scriptsApi.importToProject(projectId, doc.id, {
          characters: payload.characters,
          scenes: payload.scenes,
          props: payload.props,
          episodes: payload.episodes,
          skipExisting: true,
        })
        if (!response.success || !response.data) {
          notify.error(
            response.message ||
              (options?.auto ? "自动写入项目失败，请核对后手动重试" : "写入失败，请核对后手动重试")
          )
          return false
        }
        setDocument({ ...doc, ...(response.data.script || {}), status: "imported" })
        notify.show({
          title: options?.auto ? "已拆解并写入项目" : "已写入项目",
          description: formatScriptImportToast(response.data.created, response.data.skipped),
          variant: "success",
          duration: 4800,
        })
        return true
      } catch (error) {
        notify.error(
          error instanceof Error
            ? error.message
            : options?.auto
              ? "自动写入项目失败，请核对后手动重试"
              : "写入失败，请核对后手动重试"
        )
        return false
      } finally {
        setImporting(false)
      }
    },
    [notify, projectId]
  )

  const handleImport = async () => {
    if (!document) return
    await importDocument(document, {
      characters: selectedCharacters,
      scenes: selectedScenes,
      props: selectedProps,
      episodes: selectedEpisodes,
    })
  }

  const handleParse = async () => {
    if (!projectId) return
    if (!sourceText.trim()) {
      notify.warning("请先上传或粘贴剧本")
      return
    }
    if (blocked) {
      notify.warning(blocked)
      return
    }
    setParsing(true)
    setExcluded(new Set())
    let parsed: ScriptDocument | null = null
    try {
      const response = await scriptsApi.parse(projectId, {
        text: sourceText,
        title: title.trim() || undefined,
        filename: filename || undefined,
      })
      if (!response.success || !response.data) {
        notify.error(response.message || "剧本解析失败")
        return
      }
      parsed = response.data
      setDocument(parsed)
      setTitle(parsed.title || title)
      setResultTab("plot")
    } finally {
      setParsing(false)
    }

    if (!parsed) return

    const autoPayload = {
      characters: parsed.characters || [],
      scenes: parsed.scenes || [],
      props: parsed.props || [],
      episodes: parsed.episodes || [],
    }
    const hasItems =
      autoPayload.characters.length +
      autoPayload.scenes.length +
      autoPayload.props.length +
      autoPayload.episodes.length
    if (hasItems === 0) {
      notify.success(parsed.agent?.note || "剧本已拆解完成")
      return
    }

    await importDocument(parsed, autoPayload, { auto: true })
  }

  const counts = {
    episodes: document?.episodes.length || 0,
    scenes: document?.scenes.length || 0,
    props: document?.props.length || 0,
    characters: document?.characters.length || 0,
  }

  return (
    <WorkspaceLayout
      header={
        <WorkspaceHeader
          title="剧本创作"
          subtitle="上传剧本，一键拆成剧情、分集与资产，并自动写入剧集管理"
          searchPlaceholder="搜索剧本..."
          actions={
            document ? (
              <Button
                onClick={handleImport}
                disabled={importing || parsing}
                className="signature-gradient rounded-xl border-0 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
              >
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                {document.status === "imported" ? "再次写入项目" : "写入项目资产"}
              </Button>
            ) : null
          }
        />
      }
    >
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] gap-6 items-start">
        <section className="space-y-4">
          <Card className="border-0 bg-[hsl(var(--surface-container-lowest))] p-6 rounded-2xl shadow-none">
            <div className="flex items-center gap-2 mb-4">
              <ScrollText className="w-5 h-5 text-[hsl(var(--primary))]" />
              <h2 className="text-lg font-black text-[hsl(var(--on-surface))]">剧本原稿</h2>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void applyFile(file)
                event.target.value = ""
              }}
            />
            <label
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => void handleDrop(event)}
              onClick={() => fileInputRef.current?.click()}
              className={`mb-4 flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 transition-colors ${
                dragging
                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5"
                  : "border-[hsl(var(--outline-variant))]/50 bg-[hsl(var(--surface-container-low))] hover:bg-[hsl(var(--surface-container-high))]"
              }`}
            >
              <Upload className="mb-3 h-8 w-8 text-[hsl(var(--primary))]" />
              <p className="text-sm font-bold text-[hsl(var(--on-surface))]">
                {filename ? filename : "拖入或点击上传 txt / md"}
              </p>
              <p className="mt-1 text-xs text-[hsl(var(--secondary))]">UTF-8 文本，最大 2MB</p>
            </label>
            <Textarea
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              placeholder="也可以直接粘贴小说、剧本或分集大纲…"
              rows={16}
              className="rounded-xl bg-[hsl(var(--surface-container-low))] border-none text-sm placeholder:text-[hsl(var(--secondary))] resize-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))] leading-7"
            />
            <div className="mt-3 flex items-center justify-between text-xs text-[hsl(var(--secondary))]">
              <span>{sourceText.trim().length} 字</span>
              {filename ? <span>来源文件 {filename}</span> : <span>未选择文件，使用粘贴文本</span>}
            </div>
            <Button
              onClick={() => void handleParse()}
              disabled={parsing || !sourceText.trim() || Boolean(blocked)}
              title={blocked}
              className="mt-5 w-full h-12 signature-gradient text-white rounded-xl font-bold text-base border-0 hover:opacity-90 disabled:opacity-50"
            >
              {parsing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
              {parsing ? "Agent 正在拆解…" : costLabel ? `一键解析剧本 · ${costLabel}` : "一键解析剧本"}
            </Button>
          </Card>
        </section>

        <section className="space-y-4">
          {parsing ? (
            <Card className="border-0 bg-[hsl(var(--surface-container-lowest))] p-8 rounded-2xl shadow-none">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] text-xs font-bold mb-5">
                <Sparkles className="w-3 h-3" />
                剧本 Agent
              </div>
              <h2 className="text-2xl font-black text-[hsl(var(--on-surface))] mb-2">正在把故事拆成可拍的资产</h2>
              <p className="text-sm text-[hsl(var(--secondary))] mb-8">
                Agent 会先读完全文，再提炼主线、分集，并抽出人物、场景和道具。
              </p>
              <ol className="space-y-4">
                {AGENT_STEPS.map((step, index) => {
                  const done = index < activeStep
                  const current = index === activeStep
                  return (
                    <li key={step} className="flex items-center gap-3">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                          done || current
                            ? "signature-gradient text-white"
                            : "bg-[hsl(var(--surface-container-high))] text-[hsl(var(--secondary))]"
                        }`}
                      >
                        {done ? <Check className="h-4 w-4" /> : current ? <Loader2 className="h-4 w-4 animate-spin" /> : index + 1}
                      </span>
                      <span className={`text-sm font-bold ${current ? "text-[hsl(var(--on-surface))]" : "text-[hsl(var(--secondary))]"}`}>
                        {step}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </Card>
          ) : document ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={Clapperboard} label="分集" value={counts.episodes} />
                <StatCard icon={Image} label="场景" value={counts.scenes} />
                <StatCard icon={Box} label="道具" value={counts.props} />
                <StatCard icon={Users} label="人物" value={counts.characters} />
              </div>
              <Card className="border-0 bg-[hsl(var(--surface-container-lowest))] p-6 rounded-2xl shadow-none">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                  <div>
                    <h2 className="text-xl font-black text-[hsl(var(--on-surface))]">{document.title}</h2>
                    <p className="mt-1 text-xs text-[hsl(var(--secondary))]">
                      {document.agent?.model ? `由 ${document.agent.model} 拆解` : "已完成拆解"}
                      {document.status === "imported" ? " · 已写入剧集管理" : importing ? " · 正在写入项目…" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {RESULT_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setResultTab(tab.id)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          resultTab === tab.id
                            ? "signature-gradient text-white"
                            : "bg-[hsl(var(--surface-container-high))] text-[hsl(var(--on-surface))] hover:bg-[hsl(var(--surface-container-highest))]"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {resultTab === "plot" ? <PlotPanel document={document} /> : null}
                {resultTab === "episodes" ? (
                  <SelectableList
                    items={document.episodes}
                    kind="episode"
                    excluded={excluded}
                    onToggle={toggleExcluded}
                    render={(item) => <EpisodeCard episode={item} />}
                    empty="没有拆出分集"
                  />
                ) : null}
                {resultTab === "scenes" ? (
                  <SelectableList
                    items={document.scenes}
                    kind="scene"
                    excluded={excluded}
                    onToggle={toggleExcluded}
                    render={(item) => <SceneCard scene={item} />}
                    empty="没有拆出场景"
                  />
                ) : null}
                {resultTab === "props" ? (
                  <SelectableList
                    items={document.props}
                    kind="prop"
                    excluded={excluded}
                    onToggle={toggleExcluded}
                    render={(item) => <PropCard prop={item} />}
                    empty="没有拆出道具"
                  />
                ) : null}
                {resultTab === "characters" ? (
                  <SelectableList
                    items={document.characters}
                    kind="character"
                    excluded={excluded}
                    onToggle={toggleExcluded}
                    render={(item) => <CharacterCard character={item} />}
                    empty="没有拆出人物"
                  />
                ) : null}
              </Card>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleImport}
                  disabled={importing}
                  className="h-11 px-6 signature-gradient text-white rounded-xl font-bold border-0"
                >
                  {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  {document.status === "imported" ? "再次写入项目" : "写入项目资产"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate(projectAssetsPath(projectId, "episodes"))}
                  className="h-11 px-6 rounded-xl border-[hsl(var(--outline-variant))] font-bold"
                >
                  查看剧集管理
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/project/${projectId}/assets`)}
                  className="h-11 px-6 rounded-xl border-[hsl(var(--outline-variant))] font-bold"
                >
                  查看资产管理
                </Button>
              </div>
            </>
          ) : (
            <Card className="border-0 bg-[hsl(var(--surface-container-lowest))] p-8 rounded-2xl shadow-none min-h-[420px] flex flex-col justify-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] text-xs font-bold mb-5 w-fit">
                <Sparkles className="w-3 h-3" />
                全新模块
              </div>
              <h2 className="text-2xl font-black cn-keep text-[hsl(var(--on-surface))] mb-3">
                把一篇故事变成一套制作清单
              </h2>
              <p className="text-[hsl(var(--secondary))] max-w-lg mb-8 leading-relaxed">
                上传 txt 或 md，剧本 Agent 会一次性拆出剧情主线、分集、场景、道具和人物。解析完成后会自动写入当前项目，也可再核对后手动补写。
              </p>
              <div className="grid grid-cols-2 gap-3">
                <GhostHint icon={FileText} title="剧情" desc="一句话故事 + 梗概" />
                <GhostHint icon={Clapperboard} title="分集" desc="按情节切开的集数" />
                <GhostHint icon={Image} title="场景" desc="地点、时段与氛围" />
                <GhostHint icon={Users} title="人物 / 道具" desc="可直接进入资产库" />
              </div>
            </Card>
          )}
        </section>
      </div>
    </WorkspaceLayout>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users
  label: string
  value: number
}) {
  return (
    <Card className="border-0 bg-[hsl(var(--surface-container-lowest))] p-4 shadow-none rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-bold text-[hsl(var(--secondary))]">{label}</p>
        <Icon className="w-4 h-4 text-[hsl(var(--primary))]" />
      </div>
      <p className="text-2xl font-black text-[hsl(var(--on-surface))]">{value}</p>
    </Card>
  )
}

function GhostHint({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Users
  title: string
  desc: string
}) {
  return (
    <div className="rounded-xl bg-[hsl(var(--surface-container-low))] p-4">
      <Icon className="w-5 h-5 text-[hsl(var(--primary))] mb-2" />
      <p className="text-sm font-bold text-[hsl(var(--on-surface))]">{title}</p>
      <p className="text-xs text-[hsl(var(--secondary))] mt-1">{desc}</p>
    </div>
  )
}

function PlotPanel({ document }: { document: ScriptDocument }) {
  const plot = document.plot || {}
  return (
    <div className="space-y-5">
      {plot.logline ? (
        <div>
          <p className="text-[13px] font-bold text-[hsl(var(--secondary))] mb-2">一句话</p>
          <p className="text-lg font-bold leading-relaxed text-[hsl(var(--on-surface))]">{plot.logline}</p>
        </div>
      ) : null}
      {plot.summary ? (
        <div>
          <p className="text-[13px] font-bold text-[hsl(var(--secondary))] mb-2">剧情梗概</p>
          <p className="text-sm leading-8 text-[hsl(var(--on-surface-variant))] whitespace-pre-wrap">
            {plot.summary}
          </p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {plot.tone ? (
          <span className="px-3 py-1 rounded-full bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] text-xs font-bold">
            {plot.tone}
          </span>
        ) : null}
        {(plot.themes || []).map((theme) => (
          <span
            key={theme}
            className="px-3 py-1 rounded-full bg-[hsl(var(--surface-container-high))] text-xs font-bold text-[hsl(var(--on-surface))]"
          >
            {theme}
          </span>
        ))}
      </div>
    </div>
  )
}

function SelectableList<T extends { name: string }>({
  items,
  kind,
  excluded,
  onToggle,
  render,
  empty,
}: {
  items: T[]
  kind: string
  excluded: Set<string>
  onToggle: (key: string) => void
  render: (item: T) => ReactNode
  empty: string
}) {
  if (!items.length) {
    return <p className="text-sm text-[hsl(var(--secondary))]">{empty}</p>
  }
  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const key = itemKey(kind, item.name, index)
        const checked = !excluded.has(key)
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            className={`w-full text-left rounded-xl p-4 transition-colors ${
              checked
                ? "bg-[hsl(var(--surface-container-low))]"
                : "bg-[hsl(var(--surface-container))] opacity-55"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md ${
                  checked ? "signature-gradient text-white" : "bg-[hsl(var(--surface-container-highest))]"
                }`}
              >
                {checked ? <Check className="h-3 w-3" /> : null}
              </span>
              <div className="min-w-0 flex-1">{render(item)}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function EpisodeCard({ episode }: { episode: ScriptEpisodeDraft }) {
  return (
    <div>
      <p className="text-sm font-bold text-[hsl(var(--on-surface))]">{episode.name}</p>
      <p className="mt-2 text-sm leading-7 text-[hsl(var(--on-surface-variant))] whitespace-pre-wrap">
        {episode.summary}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(episode.characterNames || []).map((name) => (
          <span key={name} className="text-[11px] font-bold text-[hsl(var(--primary))]">
            {name}
          </span>
        ))}
        {(episode.sceneNames || []).map((name) => (
          <span key={name} className="text-[11px] text-[hsl(var(--secondary))]">
            {name}
          </span>
        ))}
      </div>
    </div>
  )
}

function SceneCard({ scene }: { scene: ScriptSceneDraft }) {
  return (
    <div>
      <p className="text-sm font-bold text-[hsl(var(--on-surface))]">{scene.name}</p>
      <p className="mt-1 text-xs text-[hsl(var(--secondary))]">
        {[scene.location, scene.time].filter(Boolean).join(" · ")}
      </p>
      {scene.description ? (
        <p className="mt-2 text-sm leading-7 text-[hsl(var(--on-surface-variant))]">{scene.description}</p>
      ) : null}
    </div>
  )
}

function PropCard({ prop }: { prop: ScriptPropDraft }) {
  const typeLabel = prop.type ? PROP_LABEL[prop.type] : ""
  return (
    <div>
      <div className="flex items-center gap-2">
        <p className="text-sm font-bold text-[hsl(var(--on-surface))]">{prop.name}</p>
        {typeLabel ? (
          <span className="text-[11px] font-bold text-[hsl(var(--primary))]">{typeLabel}</span>
        ) : null}
      </div>
      {prop.description ? (
        <p className="mt-2 text-sm leading-7 text-[hsl(var(--on-surface-variant))]">{prop.description}</p>
      ) : null}
    </div>
  )
}

function CharacterCard({ character }: { character: ScriptCharacterDraft }) {
  const roleLabel = character.role ? ROLE_LABEL[character.role] : ""
  const meta = [character.gender ? GENDER_LABEL[character.gender] : "", character.ageGroup ? AGE_LABEL[character.ageGroup] : ""].filter(Boolean)
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold text-[hsl(var(--on-surface))]">{character.name}</p>
        {roleLabel ? (
          <span className="text-[11px] font-bold text-[hsl(var(--primary))]">{roleLabel}</span>
        ) : null}
        {meta.length ? (
          <span className="text-[11px] text-[hsl(var(--secondary))]">{meta.join(" · ")}</span>
        ) : null}
      </div>
      {character.description ? (
        <p className="mt-2 text-sm leading-7 text-[hsl(var(--on-surface-variant))]">{character.description}</p>
      ) : null}
    </div>
  )
}
