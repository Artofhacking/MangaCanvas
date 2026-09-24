import { describe, expect, it } from "vitest"
import {
  aspectRatioFromNaturalSize,
  assetDetailPreviewMediaClass,
  formatAssetAspectRatio,
  resolveDisplayedAspectRatio,
} from "./assetDetailPreview"

describe("asset detail preview", () => {
  it("contains the full frame instead of cropping it", () => {
    expect(assetDetailPreviewMediaClass).toContain("object-contain")
    expect(assetDetailPreviewMediaClass).toContain("object-center")
    expect(assetDetailPreviewMediaClass.includes("object-cover")).toBe(false)
  })
})

describe("formatAssetAspectRatio", () => {
  it("keeps a stored ratio and falls back when it is missing", () => {
    expect(formatAssetAspectRatio("3:4")).toBe("3:4")
    expect(formatAssetAspectRatio("  ")).toBe("—")
    expect(formatAssetAspectRatio(null)).toBe("—")
  })
})

describe("aspectRatioFromNaturalSize", () => {
  it("reduces portrait, landscape, and square bitmaps", () => {
    expect(aspectRatioFromNaturalSize(1024, 1536)).toBe("2:3")
    expect(aspectRatioFromNaturalSize(768, 1024)).toBe("3:4")
    expect(aspectRatioFromNaturalSize(1920, 1080)).toBe("16:9")
    expect(aspectRatioFromNaturalSize(1000, 1000)).toBe("1:1")
  })

  it("rejects empty or invalid dimensions", () => {
    expect(aspectRatioFromNaturalSize(0, 1080)).toBeNull()
    expect(aspectRatioFromNaturalSize(1920, -1)).toBeNull()
    expect(aspectRatioFromNaturalSize(Number.NaN, 100)).toBeNull()
  })
})

describe("resolveDisplayedAspectRatio", () => {
  it("prefers the stored ratio, then the bitmap ratio", () => {
    expect(resolveDisplayedAspectRatio("16:9", "3:4")).toBe("16:9")
    expect(resolveDisplayedAspectRatio(null, "3:4")).toBe("3:4")
    expect(resolveDisplayedAspectRatio("  ", "2:3")).toBe("2:3")
    expect(resolveDisplayedAspectRatio(undefined, null)).toBe("—")
  })
})
