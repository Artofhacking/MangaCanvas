import { SHAPING_LABEL, normalizeShapingStatus } from "@/features/project/shaping"
import type { ShapingStatus } from "@/types"

export type EpisodeAssetKind = "character" | "scene" | "object"

const ROSTER_LINE = /^(出场|场景|物品)\s*[：:]/

export function episodeAssetImageSrc(image?: string | null): string | null {
  const value = image?.trim()
  if (!value || value === "null" || value === "undefined") return null
  return value
}

export function shouldRenderAssetImage(image: string | null | undefined, failed: boolean): boolean {
  return Boolean(episodeAssetImageSrc(image)) && !failed
}

export function episodeAssetInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return "·"
  return Array.from(trimmed)[0]
}

/**
 * One status line for an episode asset chip.
 * Post-import assets usually have an editable prompt and no cover yet.
 */
export function episodeAssetStatusLine(input: {
  shapingStatus?: ShapingStatus | null
  prompt?: string | null
}): string {
  const status = normalizeShapingStatus(input.shapingStatus)
  if (status === "final") return SHAPING_LABEL.final
  if (status === "semi") return `${SHAPING_LABEL.semi} · 未定妆`
  if (input.prompt?.trim()) return "提示词已有 · 未定妆"
  return SHAPING_LABEL.unset
}

export type EpisodePlotBlock = {
  kind: "prose" | "roster"
  lines: string[]
}

/** Light spacing for 出场 / 场景 / 物品 lines inside the episode plot. */
export function splitEpisodePlot(text: string): EpisodePlotBlock[] {
  const source = (text || "").replace(/\r\n/g, "\n")
  if (!source) return []

  const blocks: EpisodePlotBlock[] = []
  let prose: string[] = []
  let roster: string[] = []

  const flush = (kind: EpisodePlotBlock["kind"], lines: string[]) => {
    const next = kind === "roster" ? lines.filter((line) => line.trim()) : [...lines]
    if (kind === "prose") {
      while (next.length && !next[next.length - 1]?.trim()) next.pop()
    }
    if (!next.length) return
    if (kind === "prose" && next.every((line) => !line.trim())) return
    blocks.push({ kind, lines: next })
  }

  for (const line of source.split("\n")) {
    if (ROSTER_LINE.test(line.trim())) {
      flush("prose", prose)
      prose = []
      roster.push(line)
      continue
    }
    if (roster.length) {
      flush("roster", roster)
      roster = []
    }
    prose.push(line)
  }

  flush("prose", prose)
  flush("roster", roster)
  return blocks
}
