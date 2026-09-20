import { describe, expect, it } from "vitest"
import { buildUploadedAssetPayload, fileNameToAssetName } from "./assetBatchUpload"

describe("fileNameToAssetName", () => {
  it("strips extension and separators", () => {
    expect(fileNameToAssetName("fog-alley.png", "未命名场景")).toBe("fog alley")
  })

  it("falls back when the name is empty", () => {
    expect(fileNameToAssetName(".png", "未命名物品")).toBe("未命名物品")
  })
})

describe("buildUploadedAssetPayload", () => {
  it("builds a character upload payload", () => {
    expect(buildUploadedAssetPayload("character", "雾隐", "https://img/c.png")).toMatchObject({
      name: "雾隐",
      genMethod: "upload",
      referenceImage: "https://img/c.png",
      gender: "other",
      ageGroup: "young",
    })
  })

  it("builds a scene upload payload that lands in-use", () => {
    expect(buildUploadedAssetPayload("scene", "夜雨巷", "https://img/s.png")).toMatchObject({
      name: "夜雨巷",
      genMethod: "upload",
      status: "in-use",
      referenceImage: "https://img/s.png",
      distance: 8,
      zoom: 0.6,
    })
  })

  it("builds an object upload payload", () => {
    expect(buildUploadedAssetPayload("object", "油纸伞", "https://img/o.png")).toMatchObject({
      name: "油纸伞",
      genMethod: "upload",
      referenceImage: "https://img/o.png",
      aspectRatio: "1:1",
    })
  })
})
