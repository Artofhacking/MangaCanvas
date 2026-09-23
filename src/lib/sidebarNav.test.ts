import { describe, expect, it } from "vitest"
import {
  episodeIdFromPath,
  formatEpisodeNavLabel,
  resolveProjectSidebarSection,
  sortEpisodesForNav,
} from "./sidebarNav"

describe("resolveProjectSidebarSection", () => {
  it("highlights 剧集 for episode overview and canvas, not 资产 or 工作台", () => {
    expect(resolveProjectSidebarSection("/project/9/episode/3")).toBe("episodes")
    expect(resolveProjectSidebarSection("/project/9/episode/3/canvas")).toBe("episodes")
    expect(resolveProjectSidebarSection("/project/9/episode/3?view=storyboard")).toBe("episodes")
  })

  it("keeps the assets episodes tab on 资产", () => {
    expect(resolveProjectSidebarSection("/project/9/assets")).toBe("assets")
    expect(resolveProjectSidebarSection("/project/9/assets/episodes")).toBe("assets")
    expect(resolveProjectSidebarSection("/project/9/assets/favorites")).toBe("assets")
  })

  it("keeps the other top-level sections", () => {
    expect(resolveProjectSidebarSection("/project/9/dashboard")).toBe("workbench")
    expect(resolveProjectSidebarSection("/project/9/workflows/12")).toBe("workbench")
    expect(resolveProjectSidebarSection("/project/9/script")).toBe("script")
    expect(resolveProjectSidebarSection("/project/9/settings")).toBe("settings")
    expect(resolveProjectSidebarSection("/projects")).toBeNull()
  })
})

describe("episodeIdFromPath", () => {
  it("reads the episode id from overview and canvas paths", () => {
    expect(episodeIdFromPath("/project/9/episode/12")).toBe(12)
    expect(episodeIdFromPath("/project/9/episode/12/canvas")).toBe(12)
    expect(episodeIdFromPath("/project/9/assets/episodes")).toBeNull()
  })
})

describe("formatEpisodeNavLabel", () => {
  it("prefers 第NN集 plus a short title", () => {
    expect(formatEpisodeNavLabel({ name: "第3集：雨夜重逢" }, 1)).toEqual({
      label: "第03集 雨夜重逢",
      fullLabel: "第03集 雨夜重逢",
    })
    expect(formatEpisodeNavLabel({ name: "第一集" }, 4)).toEqual({
      label: "第01集",
      fullLabel: "第01集",
    })
    expect(formatEpisodeNavLabel({ name: "第十二话 夜航" }, 1)).toEqual({
      label: "第12集 夜航",
      fullLabel: "第12集 夜航",
    })
  })

  it("truncates a long title and falls back to list order", () => {
    expect(formatEpisodeNavLabel({ name: "雨夜重逢之后的长标题" }, 2)).toEqual({
      label: "第02集 雨夜重逢之后的长…",
      fullLabel: "第02集 雨夜重逢之后的长标题",
    })
  })

  it("reads the script episode code when the name has no number", () => {
    expect(formatEpisodeNavLabel({ name: "雨夜", code: "S4E02T171000" }, 9)).toEqual({
      label: "第02集 雨夜",
      fullLabel: "第02集 雨夜",
    })
    expect(formatEpisodeNavLabel({ name: "入学", code: "EP01" }, 9)).toEqual({
      label: "第01集 入学",
      fullLabel: "第01集 入学",
    })
    expect(formatEpisodeNavLabel({ name: "手动创建", code: "EP_1710000000000" }, 3).label).toBe(
      "第03集 手动创建"
    )
  })
})

describe("sortEpisodesForNav", () => {
  it("sorts by episode number, then creation id, ignoring EP_ timestamps", () => {
    const sorted = sortEpisodesForNav([
      { id: 8, name: "第02集 夜航", code: "S1E02T1" },
      { id: 3, name: "手动乙", code: "EP_200" },
      { id: 2, name: "第01集", code: "S1E01T1" },
      { id: 4, name: "手动甲", code: "EP_100" },
    ])
    expect(sorted.map((item) => item.id)).toEqual([2, 8, 3, 4])
    expect(
      sortEpisodesForNav([
        { id: 30, name: "试剑", code: "EP03" },
        { id: 10, name: "入学", code: "EP01" },
      ]).map((item) => item.id)
    ).toEqual([10, 30])
  })
})
