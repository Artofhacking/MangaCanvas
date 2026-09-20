import { describe, expect, it } from "vitest"
import { formatScriptImportToast } from "./scriptImport"

describe("formatScriptImportToast", () => {
  it("reports created counts when nothing is skipped", () => {
    expect(
      formatScriptImportToast(
        { episodes: 3, scenes: 2, objects: 1, characters: 4 },
        { episodes: 0, scenes: 0, objects: 0, characters: 0 }
      )
    ).toBe("已写入 3 集、2 个场景、1 件道具、4 个人物。可到「剧集管理」查看。")
  })

  it("reports created and skipped counts together", () => {
    expect(
      formatScriptImportToast(
        { episodes: 2, scenes: 1, objects: 0, characters: 3 },
        { episodes: 1, scenes: 0, objects: 1, characters: 0 }
      )
    ).toBe("已写入 2 集、1 个场景、0 件道具、3 个人物；跳过 1 集、0 个场景、1 件道具、0 个人物。可到「剧集管理」查看。")
  })

  it("explains a skip-only result instead of claiming a new write", () => {
    expect(
      formatScriptImportToast(
        { episodes: 0, scenes: 0, objects: 0, characters: 0 },
        { episodes: 3, scenes: 2, objects: 1, characters: 4 }
      )
    ).toBe("这些条目已在项目资产中，未重复创建（跳过 3 集、2 个场景、1 件道具、4 个人物）。可到「剧集管理」查看。")
  })
})
