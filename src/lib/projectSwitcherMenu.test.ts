import { describe, expect, it } from "vitest"

import {
  PROJECT_ROW_ACTION_LABELS,
  PROJECT_ROW_ACTIONS,
  canManageProject,
  nextProjectAfterDelete,
  projectRowActions,
} from "./projectSwitcherMenu"

describe("project switcher manage access", () => {
  const project = { ownerId: 7 }

  it("lets the owner and org/system admins manage a project", () => {
    expect(canManageProject(project, { id: 7, roleId: 3 })).toBe(true)
    expect(canManageProject(project, { id: 9, roleId: 1 })).toBe(true)
    expect(canManageProject(project, { id: 9, roleId: 2 })).toBe(true)
  })

  it("hides rename, copy, and delete from editors and viewers", () => {
    expect(projectRowActions(project, { id: 8, roleId: 3 })).toEqual([])
    expect(projectRowActions({ ownerId: null }, null)).toEqual([])
    expect(projectRowActions(project, { id: 7, roleId: 3 })).toEqual([...PROJECT_ROW_ACTIONS])
    expect(PROJECT_ROW_ACTION_LABELS).toEqual({
      rename: "重命名",
      copy: "复制",
      delete: "删除",
    })
  })
})

describe("nextProjectAfterDelete", () => {
  it("picks the most recently updated remaining project", () => {
    const next = nextProjectAfterDelete(
      [
        { id: 1, name: "当前", updatedAt: "2026-10-02T00:00:00.000Z" },
        { id: 2, name: "更早", updatedAt: "2026-09-01T00:00:00.000Z" },
        { id: 3, name: "最近", updatedAt: "2026-10-01T00:00:00.000Z" },
      ],
      1,
    )
    expect(next).toEqual({ id: 3, name: "最近", updatedAt: "2026-10-01T00:00:00.000Z" })
  })

  it("returns null when the deleted project was the last one", () => {
    expect(nextProjectAfterDelete([{ id: 4, name: "仅此一个", updatedAt: null }], 4)).toBeNull()
  })
})
