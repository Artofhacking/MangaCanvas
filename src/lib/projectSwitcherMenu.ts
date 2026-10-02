import { isAdmin } from "@/lib/session"

export const PROJECT_ROW_ACTIONS = ["rename", "copy", "delete"] as const

export type ProjectRowAction = (typeof PROJECT_ROW_ACTIONS)[number]

export const PROJECT_ROW_ACTION_LABELS: Record<ProjectRowAction, string> = {
  rename: "重命名",
  copy: "复制",
  delete: "删除",
}

export type ProjectManageSubject = {
  ownerId?: number | null
}

export type ProjectManageActor = {
  id: number
  roleId?: number | null
}

/** 项目所有者，或系统/组织管理员，才能在切换器里重命名、复制、删除。 */
export function canManageProject(
  project: ProjectManageSubject,
  user: ProjectManageActor | null | undefined,
): boolean {
  if (!user) return false
  if (isAdmin(user.roleId ?? undefined)) return true
  return project.ownerId != null && project.ownerId === user.id
}

export function projectRowActions(
  project: ProjectManageSubject,
  user: ProjectManageActor | null | undefined,
): ProjectRowAction[] {
  return canManageProject(project, user) ? [...PROJECT_ROW_ACTIONS] : []
}

type DatedProject = {
  id: number
  name: string
  updatedAt?: string | null
  createdAt?: string | null
}

const timestamp = (project: DatedProject) =>
  Date.parse(project.updatedAt || project.createdAt || "") || 0

/** 删掉当前项目后，切到其余项目里最近更新的一个。 */
export function nextProjectAfterDelete<T extends DatedProject>(
  projects: T[],
  deletedId: number,
): T | null {
  const remaining = projects.filter((project) => project.id !== deletedId)
  if (remaining.length === 0) return null
  return [...remaining].sort(
    (left, right) => timestamp(right) - timestamp(left) || right.id - left.id,
  )[0]
}
