export type ProjectSidebarSection = "workbench" | "script" | "episodes" | "assets" | "settings"

const PROJECT_EPISODE_PATH = /\/project\/\d+\/episode\/(\d+)(?:\/|$|\?|#)/

const EPISODE_NAME_PATTERN =
  /^(?:第\s*([0-9]{1,3}|[零〇一二三四五六七八九十两]{1,4})\s*[集话章]|episode\s*([0-9]{1,3})|ep\.?\s*([0-9]{1,3}))(?:\s*[|：:、\-—·]\s*|\s+)?(.*)$/i

const SCRIPT_EPISODE_CODE = /E(\d{1,3})T/i
const PLAIN_EPISODE_CODE = /^EP(\d{1,3})$/i

const CN_DIGIT: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
}

export const EPISODE_NAV_TITLE_LIMIT = 8

export type EpisodeNavSource = {
  id: number
  name: string
  code?: string | null
}

export function resolveProjectSidebarSection(pathname: string): ProjectSidebarSection | null {
  if (!/^\/project\/\d+(?:\/|$)/.test(pathname)) return null
  if (/\/project\/\d+\/script(?:\/|$)/.test(pathname)) return "script"
  if (PROJECT_EPISODE_PATH.test(pathname)) return "episodes"
  if (/\/project\/\d+\/assets(?:\/|$)/.test(pathname)) return "assets"
  if (/\/project\/\d+\/(?:settings|permissions)(?:\/|$)/.test(pathname)) return "settings"
  if (/^\/project\/\d+\/dashboard\/?$/.test(pathname) || /\/project\/\d+\/workflows\//.test(pathname)) {
    return "workbench"
  }
  return null
}

export function isProjectFavoritesPath(pathname: string): boolean {
  return /\/project\/\d+\/assets\/favorites(?:\/|$)/.test(pathname)
}

export function episodeIdFromPath(pathname: string): number | null {
  const matched = pathname.match(PROJECT_EPISODE_PATH)
  if (!matched) return null
  const id = Number(matched[1])
  return Number.isFinite(id) ? id : null
}

function parseChineseNumber(raw: string): number | null {
  if (!raw) return null
  if (raw === "十") return 10
  if (raw.startsWith("十")) {
    const ones = CN_DIGIT[raw.slice(1)]
    return raw.length === 2 && ones != null ? 10 + ones : null
  }
  if (raw.endsWith("十") && raw.length === 2) {
    const tens = CN_DIGIT[raw[0]]
    return tens != null ? tens * 10 : null
  }
  const tensSplit = raw.split("十")
  if (tensSplit.length === 2 && raw.includes("十")) {
    const tens = CN_DIGIT[tensSplit[0]]
    const ones = tensSplit[1] ? CN_DIGIT[tensSplit[1]] : 0
    if (tens == null || ones == null || tensSplit[0].length !== 1 || tensSplit[1].length > 1) return null
    return tens * 10 + ones
  }
  if (raw.length === 1 && CN_DIGIT[raw] != null && CN_DIGIT[raw] > 0) return CN_DIGIT[raw]
  return null
}

function positiveInt(value: number | null): number | null {
  if (value == null || !Number.isInteger(value) || value <= 0) return null
  return value
}

function readNameEpisode(name: string): { number: number | null; title: string } {
  const trimmed = name.trim()
  const matched = trimmed.match(EPISODE_NAME_PATTERN)
  if (!matched) return { number: null, title: trimmed }
  const raw = matched[1] || matched[2] || matched[3] || ""
  const number = positiveInt(/^\d+$/.test(raw) ? Number(raw) : parseChineseNumber(raw))
  if (number == null) return { number: null, title: trimmed }
  return { number, title: (matched[4] || "").trim() }
}

function readCodeEpisodeNumber(code?: string | null): number | null {
  if (!code) return null
  const scriptCode = code.match(SCRIPT_EPISODE_CODE)
  if (scriptCode) return positiveInt(Number(scriptCode[1]))
  const plainCode = code.trim().match(PLAIN_EPISODE_CODE)
  if (plainCode) return positiveInt(Number(plainCode[1]))
  return null
}

export function episodeSortNumber(episode: Pick<EpisodeNavSource, "name" | "code">): number | null {
  return readNameEpisode(episode.name).number ?? readCodeEpisodeNumber(episode.code)
}

export function sortEpisodesForNav<T extends EpisodeNavSource>(episodes: T[]): T[] {
  return [...episodes].sort((left, right) => {
    const leftNumber = episodeSortNumber(left)
    const rightNumber = episodeSortNumber(right)
    if (leftNumber != null && rightNumber != null && leftNumber !== rightNumber) {
      return leftNumber - rightNumber
    }
    if (leftNumber != null && rightNumber == null) return -1
    if (leftNumber == null && rightNumber != null) return 1
    return left.id - right.id
  })
}

function episodePrefix(order: number): string {
  return `第${String(order).padStart(2, "0")}集`
}

function shortenTitle(title: string): string {
  if (title.length <= EPISODE_NAV_TITLE_LIMIT) return title
  return `${title.slice(0, EPISODE_NAV_TITLE_LIMIT)}…`
}

export function formatEpisodeNavLabel(
  episode: Pick<EpisodeNavSource, "name" | "code">,
  fallbackOrder: number
): { label: string; fullLabel: string } {
  const parsed = readNameEpisode(episode.name)
  const order = parsed.number ?? readCodeEpisodeNumber(episode.code) ?? Math.max(1, fallbackOrder)
  const prefix = episodePrefix(order)
  const title = parsed.number != null ? parsed.title : episode.name.trim()
  if (!title) {
    return { label: prefix, fullLabel: prefix }
  }
  const fullLabel = `${prefix} ${title}`
  return { label: `${prefix} ${shortenTitle(title)}`, fullLabel }
}
