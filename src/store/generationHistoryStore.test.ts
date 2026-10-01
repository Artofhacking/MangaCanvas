import { describe, expect, it } from "vitest"
import {
  normalizeGenerationMediaType,
  useGenerationHistoryStore,
} from "./generationHistoryStore"

describe("generation history media types", () => {
  it("keeps audio distinct from image and video", () => {
    expect(normalizeGenerationMediaType("audio")).toBe("audio")
    expect(normalizeGenerationMediaType("video")).toBe("video")
    expect(normalizeGenerationMediaType("image")).toBe("image")
    expect(normalizeGenerationMediaType("other")).toBe("image")

    const id = useGenerationHistoryStore.getState().start({
      mediaType: "audio",
      prompt: "旁白：夜色降临在旧城",
      source: "audio",
    })
    const created = useGenerationHistoryStore.getState().items.find((item) => item.id === id)
    expect(created?.mediaType).toBe("audio")
    expect(created?.status).toBe("running")
    expect(created?.title.startsWith("旁白：夜色降临在旧城")).toBe(true)

    useGenerationHistoryStore.getState().succeed(id, "https://cdn.example/voice.mp3")
    const done = useGenerationHistoryStore.getState().items.find((item) => item.id === id)
    expect(done?.status).toBe("succeeded")
    expect(done?.mediaType).toBe("audio")
    expect(done?.resultUrl).toBe("https://cdn.example/voice.mp3")
  })
})
