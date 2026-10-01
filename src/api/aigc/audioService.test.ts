import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/api/clients/appClient", () => ({
  appClient: {},
}))

vi.mock("@/api/core/response", () => ({
  requestData: vi.fn(),
}))

import { requestData } from "@/api/core/response"
import { useGenerationHistoryStore } from "@/store/generationHistoryStore"
import { audioService } from "./audioService"

const request = vi.mocked(requestData)

describe("audioService generation history", () => {
  beforeEach(() => {
    request.mockReset()
  })

  it("records a successful speech generation", async () => {
    request.mockResolvedValue({ url: "https://cdn.example/line.mp3" })
    const url = await audioService.generate({
      model: "speech-2.8-hd",
      text: "旁白：雨停了",
    })
    expect(url).toBe("https://cdn.example/line.mp3")
    const item = useGenerationHistoryStore.getState().items.find((entry) => entry.prompt === "旁白：雨停了")
    expect(item?.mediaType).toBe("audio")
    expect(item?.status).toBe("succeeded")
    expect(item?.resultUrl).toBe("https://cdn.example/line.mp3")
  })

  it("records a failure and rethrows", async () => {
    request.mockRejectedValue(new Error("配音失败"))
    await expect(audioService.generate({ model: "speech-2.8-hd", text: "旁白：失败样本" })).rejects.toThrow("配音失败")
    const item = useGenerationHistoryStore.getState().items.find((entry) => entry.prompt === "旁白：失败样本")
    expect(item?.status).toBe("failed")
    expect(item?.error).toBe("配音失败")
  })

  it("marks an aborted generation as cancelled", async () => {
    const error = new Error("The operation was aborted")
    error.name = "AbortError"
    request.mockRejectedValue(error)
    await expect(audioService.generate({ model: "music-3.0", prompt: "钢琴夜曲" })).rejects.toBe(error)
    const item = useGenerationHistoryStore.getState().items.find((entry) => entry.prompt === "钢琴夜曲")
    expect(item?.status).toBe("failed")
    expect(item?.error).toBe("已取消")
  })
})
