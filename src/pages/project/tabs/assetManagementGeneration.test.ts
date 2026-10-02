import { createElement } from "react"
import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import ShapingPanel from "@/features/project/ShapingPanel"
import AssetQuickCreateCard from "./AssetQuickCreateCard"

const assetSurfaces = [
  "src/pages/project/tabs/CharactersTab.tsx",
  "src/pages/project/tabs/ScenesTab.tsx",
  "src/pages/project/tabs/ObjectsTab.tsx",
  "src/pages/project/CharacterCreator.tsx",
  "src/pages/project/SceneCreator.tsx",
  "src/pages/project/ObjectCreator.tsx",
  "src/pages/project/CharacterForm.tsx",
]

describe("asset management has no generate controls", () => {
  it("keeps upload and canvas on the add card, without quick create", () => {
    const html = renderToStaticMarkup(
      createElement(AssetQuickCreateCard, {
        variant: "character",
        title: "添加角色",
        description: "上传入库，出图请到画布。",
        onUpload: () => {},
        onOpenCanvas: () => {},
      }),
    )

    expect(html).toContain("上传入库")
    expect(html).toContain("无限画布")
    expect(html).toContain("出图请到画布")
    expect(html).not.toContain("快捷创作")
    expect(html).not.toContain("生成")
  })

  it("points a locked prompt toward the canvas instead of the editor generate flow", () => {
    const html = renderToStaticMarkup(
      createElement(ShapingPanel, {
        status: "semi",
        prompt: "黑发青年",
      }),
    )

    expect(html).toContain("出图请到无限画布")
    expect(html).not.toContain("在编辑里生成")
  })

  it("does not wire generate actions on the asset pages", () => {
    for (const file of assetSurfaces) {
      const source = readFileSync(file, "utf8")
      expect(source, file).not.toContain("快捷创作")
      expect(source, file).not.toContain("onGenerate")
      expect(source, file).not.toContain("useAssetGenerationStore")
      expect(source, file).not.toContain("生成任务")
      expect(source, file).not.toMatch(/>\s*生成\s*</)
    }
  })
})
