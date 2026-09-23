import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { EpisodeAssetCard } from "./EpisodeAssetCard"
import {
  episodeAssetImageSrc,
  episodeAssetInitial,
  episodeAssetStatusLine,
  shouldRenderAssetImage,
  splitEpisodePlot,
} from "./episodeOverview"

describe("episodeAssetStatusLine", () => {
  it("says the prompt is ready and the cover is not finalized after import", () => {
    expect(episodeAssetStatusLine({ shapingStatus: "unset", prompt: "女，二十多岁，黑发及肩" })).toBe(
      "提示词已有 · 未定妆"
    )
  })

  it("keeps the locked-prompt wording and still marks the cover as unset", () => {
    expect(episodeAssetStatusLine({ shapingStatus: "semi", prompt: "暖光台灯" })).toBe("提示词已锁 · 未定妆")
  })

  it("uses the existing finalized label", () => {
    expect(episodeAssetStatusLine({ shapingStatus: "final", prompt: "已有封面" })).toBe("已定妆")
  })

  it("falls back to the unset label when there is no prompt", () => {
    expect(episodeAssetStatusLine({ shapingStatus: "unset", prompt: "  " })).toBe("还没定")
    expect(episodeAssetStatusLine({})).toBe("还没定")
  })
})

describe("episode asset image fallback", () => {
  it("treats blank and nullish sources as missing", () => {
    expect(episodeAssetImageSrc(undefined)).toBeNull()
    expect(episodeAssetImageSrc(null)).toBeNull()
    expect(episodeAssetImageSrc("")).toBeNull()
    expect(episodeAssetImageSrc("   ")).toBeNull()
    expect(episodeAssetImageSrc("null")).toBeNull()
  })

  it("hides the image after a load error", () => {
    expect(shouldRenderAssetImage("/static/lin.png", false)).toBe(true)
    expect(shouldRenderAssetImage("/static/lin.png", true)).toBe(false)
    expect(shouldRenderAssetImage("", true)).toBe(false)
  })

  it("uses the first character of the name", () => {
    expect(episodeAssetInitial("林夏")).toBe("林")
    expect(episodeAssetInitial(" 台灯")).toBe("台")
    expect(episodeAssetInitial("")).toBe("·")
  })

  it("renders a letter placeholder and no img when the cover is missing", () => {
    const html = renderToStaticMarkup(
      createElement(EpisodeAssetCard, {
        name: "林夏",
        kind: "character",
        statusLine: "提示词已有 · 未定妆",
        onClick: () => undefined,
      })
    )
    expect(html).not.toContain("<img")
    expect(html).toContain("林")
    expect(html).toContain("林夏")
    expect(html).toContain("提示词已有 · 未定妆")
  })

  it("renders a scene glyph instead of an empty image bar", () => {
    const html = renderToStaticMarkup(
      createElement(EpisodeAssetCard, {
        name: "出租屋客厅",
        kind: "scene",
        statusLine: "提示词已有 · 未定妆",
        onClick: () => undefined,
      })
    )
    expect(html).not.toContain("<img")
    expect(html).toContain("出租屋客厅")
    expect(html).toContain("<svg")
  })

  it("keeps a cover image when a source exists, hidden until it loads", () => {
    const html = renderToStaticMarkup(
      createElement(EpisodeAssetCard, {
        name: "林夏",
        image: "/static/lin.png",
        kind: "character",
        statusLine: "已定妆",
        onClick: () => undefined,
      })
    )
    expect(html).toContain('src="/static/lin.png"')
    expect(html).toContain("opacity-0")
    expect(html).toContain("林")
  })
})

describe("splitEpisodePlot", () => {
  it("leaves ordinary plot text as one prose block", () => {
    expect(splitEpisodePlot("她推开门。\n\n屋里只有一盏灯。")).toEqual([
      { kind: "prose", lines: ["她推开门。", "", "屋里只有一盏灯。"] },
    ])
  })

  it("separates trailing roster lines so they can breathe", () => {
    const text = ["@林夏推开老旧木门。", "", "出场： @林夏 （女，二十多岁）", "场景： @出租屋客厅 （夜晚）", "物品： @台灯 、 @分镜稿"].join(
      "\n"
    )
    expect(splitEpisodePlot(text)).toEqual([
      { kind: "prose", lines: ["@林夏推开老旧木门。"] },
      {
        kind: "roster",
        lines: ["出场： @林夏 （女，二十多岁）", "场景： @出租屋客厅 （夜晚）", "物品： @台灯 、 @分镜稿"],
      },
    ])
  })
})
