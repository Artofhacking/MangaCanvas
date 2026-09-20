import { getActiveProjectId } from "@/lib/session"
import { projectDashboardPath } from "@/lib/workspaceRoutes"

export const APP_HOME_PATH = "/dashboard"

type ProjectRef = {
  id: number
  updatedAt?: string | null
  createdAt?: string | null
}

const timestamp = (project: ProjectRef) =>
  Date.parse(project.updatedAt || project.createdAt || "") || 0

/** Last-opened project if it still exists; otherwise the most recently updated one. */
export function pickPreferredProjectId(projects: ProjectRef[]): number | null {
  if (projects.length === 0) {
    return null
  }

  const lastOpened = getActiveProjectId()
  if (lastOpened != null && projects.some((project) => project.id === lastOpened)) {
    return lastOpened
  }

  const [mostRecent] = [...projects].sort((left, right) => timestamp(right) - timestamp(left))
  return mostRecent?.id ?? projects[0].id
}

export function resolveAppHomePath(projects: ProjectRef[]): string {
  const projectId = pickPreferredProjectId(projects)
  return projectId ? projectDashboardPath(projectId) : APP_HOME_PATH
}
