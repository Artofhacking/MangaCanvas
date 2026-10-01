import { describe, expect, it } from "vitest"
import type { GenerationHistoryItem } from "@/store/generationHistoryStore"
import { collectGenerationCompletions } from "./generationCompleteNotify"

function item(patch: Partial<GenerationHistoryItem> & Pick<GenerationHistoryItem, "id" | "status">): GenerationHistoryItem {
  return {
    mediaType: "image",
    title: "雨夜街道",
    prompt: "雨夜街道",
    createdAt: 1,
    ...patch,
  }
}

describe("collectGenerationCompletions", () => {
  it("notifies when a running job succeeds or fails", () => {
    const previous = [
      item({ id: "img", status: "running", mediaType: "image" }),
      item({ id: "vid", status: "running", mediaType: "video" }),
      item({ id: "aud", status: "running", mediaType: "audio" }),
    ]
    const next = [
      item({ id: "img", status: "succeeded", mediaType: "image", resultUrl: "https://cdn/a.png" }),
      item({ id: "vid", status: "failed", mediaType: "video", error: "视频生成失败" }),
      item({ id: "aud", status: "succeeded", mediaType: "audio", resultUrl: "https://cdn/a.mp3" }),
    ]
    expect(collectGenerationCompletions(previous, next).map((event) => event.item.id)).toEqual(["img", "vid", "aud"])
  })

  it("ignores hydrated results, repeat success, and user cancel", () => {
    const settled = item({ id: "old", status: "succeeded" })
    expect(collectGenerationCompletions([], [settled])).toEqual([])
    expect(collectGenerationCompletions([settled], [{ ...settled, resultUrl: "https://cdn/a.png" }])).toEqual([])
    const running = item({ id: "cancel", status: "running" })
    expect(
      collectGenerationCompletions([running], [{ ...running, status: "failed", error: "已取消" }]),
    ).toEqual([])
  })

  it("returns every completion in one burst so the popup layer can stack them", () => {
    const previous = [1, 2, 3, 4].map((index) => item({ id: `job-${index}`, status: "running" }))
    const next = previous.map((entry) => ({ ...entry, status: "succeeded" as const }))
    expect(collectGenerationCompletions(previous, next)).toHaveLength(4)
  })
})
