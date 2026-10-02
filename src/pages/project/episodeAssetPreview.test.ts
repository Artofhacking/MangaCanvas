import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PLACEHOLDER_COVER_URL } from "@/lib/assetSeed"
import type { Character, ObjectItem, Scene } from "@/types"
import { EpisodeAssociationRow } from "./EpisodeAssociationRow"
import { coverForEpisodeDetail, resolveEpisodeAssetPreview } from "./episodeAssetPreview"

const character = (patch: Partial<Character> = {}): Character => ({
  id: 1,
  name: "女性角色 三视图-2",
  image: "/static/role.png",
  hasImage: true,
  role: "配角",
  style: "写实",
  scenes: 2,
  description: "黑发及肩，白色上衣，正面与侧面三视图",
  aspectRatio: "3:4",
  shapingStatus: "final",
  ...patch,
})

const scene = (patch: Partial<Scene> = {}): Scene => ({
  id: 5,
  name: "图片节点 5",
  image: "/static/room.png",
  hasImage: true,
  status: "in-use",
  modified: "刚刚",
  code: "SC_005",
  description: "夜晚出租屋，暖色台灯",
  aspectRatio: "16:9",
  ...patch,
})

const object = (patch: Partial<ObjectItem> = {}): ObjectItem => ({
  id: 8,
  name: "西瓜与灯",
  image: "/static/melon.png",
  hasImage: true,
  type: "道具",
  status: "in-use",
  scene: "未关联场景",
  modified: "1 小时前",
  description: "切开的西瓜，旁边一盏小灯",
  ...patch,
})

describe("coverForEpisodeDetail", () => {
  it("keeps a real cover and drops placeholders", () => {
    expect(coverForEpisodeDetail("/static/role.png", true)).toBe("/static/role.png")
    expect(coverForEpisodeDetail(PLACEHOLDER_COVER_URL, true)).toBeUndefined()
    expect(coverForEpisodeDetail("/static/role.png", false)).toBeUndefined()
    expect(coverForEpisodeDetail("  ", true)).toBeUndefined()
  })
})

describe("resolveEpisodeAssetPreview", () => {
  const catalog = {
    characters: [character()],
    scenes: [scene()],
    objects: [object()],
  }
  const related = { characters: [], scenes: [], objects: [] }

  it("returns the character image and prompt for the detail modal", () => {
    expect(resolveEpisodeAssetPreview({ kind: "character", id: 1 }, catalog, related)).toMatchObject({
      name: "女性角色 三视图-2",
      image: "/static/role.png",
      prompt: "黑发及肩，白色上衣，正面与侧面三视图",
      aspectRatio: "3:4",
      role: "配角",
    })
  })

  it("returns scene and prop prompts without cropping data", () => {
    expect(resolveEpisodeAssetPreview({ kind: "scene", id: 5 }, catalog, related)).toMatchObject({
      image: "/static/room.png",
      prompt: "夜晚出租屋，暖色台灯",
      aspectRatio: "16:9",
      statusLabel: "使用中",
    })
    expect(resolveEpisodeAssetPreview({ kind: "object", id: 8 }, catalog, related)).toMatchObject({
      image: "/static/melon.png",
      prompt: "切开的西瓜，旁边一盏小灯",
      objectType: "道具",
    })
  })

  it("hides a placeholder cover but still shows the prompt", () => {
    const preview = resolveEpisodeAssetPreview(
      { kind: "character", id: 1 },
      {
        ...catalog,
        characters: [character({ image: PLACEHOLDER_COVER_URL, hasImage: false, description: "只有提示词" })],
      },
      related,
    )
    expect(preview?.image).toBeUndefined()
    expect(preview?.prompt).toBe("只有提示词")
  })

  it("falls back to the linked relation when the catalog row is missing", () => {
    const preview = resolveEpisodeAssetPreview(
      { kind: "scene", id: 9 },
      { characters: [], scenes: [], objects: [] },
      {
        characters: [],
        scenes: [{ id: 9, name: "出租屋", image: "/static/room.png", hasImage: true, description: "冷白灯" }],
        objects: [],
      },
    )
    expect(preview).toMatchObject({
      name: "出租屋",
      image: "/static/room.png",
      prompt: "冷白灯",
    })
  })

  it("returns null when the asset cannot be found", () => {
    expect(resolveEpisodeAssetPreview({ kind: "object", id: 99 }, catalog, related)).toBeNull()
  })
})

describe("EpisodeAssociationRow", () => {
  it("keeps the checkbox separate from the preview button", () => {
    const html = renderToStaticMarkup(
      createElement(EpisodeAssociationRow, {
        name: "女性角色 三视图-2",
        image: "/static/role.png",
        checked: false,
        onToggle: () => undefined,
        onPreview: () => undefined,
      }),
    )
    const inputAt = html.indexOf('type="checkbox"')
    const buttonAt = html.indexOf("<button")
    const buttonEnd = html.indexOf("</button>")
    expect(inputAt).toBeGreaterThan(-1)
    expect(buttonAt).toBeGreaterThan(inputAt)
    expect(html.slice(buttonAt, buttonEnd)).not.toContain("checkbox")
    expect(html.slice(buttonAt, buttonEnd)).toContain("女性角色 三视图-2")
    expect(html).toContain('aria-label="关联 女性角色 三视图-2"')
    expect(html).toContain('aria-label="查看 女性角色 三视图-2"')
    expect(html).toContain('src="/static/role.png"')
  })
})
