import type { GenerationHistoryItem } from "@/store/generationHistoryStore"

export type GenerationCompletion = {
  item: GenerationHistoryItem
}

const SILENT_FAILURES = new Set(["已取消"])

export function isSilentGenerationFailure(error?: string) {
  if (!error) return false
  return SILENT_FAILURES.has(error.trim())
}

/** Running → succeeded/failed transitions. Hydrated history and user cancels stay quiet. */
export function collectGenerationCompletions(
  previous: GenerationHistoryItem[],
  next: GenerationHistoryItem[],
): GenerationCompletion[] {
  const prevById = new Map(previous.map((item) => [item.id, item]))
  const events: GenerationCompletion[] = []
  for (const item of next) {
    const before = prevById.get(item.id)
    if (!before || before.status !== "running") continue
    if (item.status === "succeeded") {
      events.push({ item })
      continue
    }
    if (item.status === "failed" && !isSilentGenerationFailure(item.error)) {
      events.push({ item })
    }
  }
  return events
}
