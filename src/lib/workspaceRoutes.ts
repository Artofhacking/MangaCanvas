export const ASSET_TABS = ["episodes", "characters", "scenes", "objects", "workflows"] as const

export type AssetTab = (typeof ASSET_TABS)[number]

const PROJECT_PATH = /^\/project\/(\d+)(?:\/(.*))?$/

export const isAssetTab = (value?: string): value is AssetTab =>
  Boolean(value && (ASSET_TABS as readonly string[]).includes(value))

export const isProjectShellPath = (pathname: string) => pathname.startsWith("/project/")

export const isOrgShellPath = (pathname: string) =>
  pathname === "/projects" || pathname === "/members" || pathname === "/dashboard" || pathname === "/assets"

export const projectDashboardPath = (projectId: number | string) => `/project/${projectId}/dashboard`

export const projectScriptPath = (projectId: number | string) => `/project/${projectId}/script`

export const projectAssetsPath = (projectId: number | string, tab?: string) =>
  tab ? `/project/${projectId}/assets/${tab}` : `/project/${projectId}/assets`

export const projectSettingsPath = (projectId: number | string) => `/project/${projectId}/settings`

export const switchProjectPath = (pathname: string, nextProjectId: number | string) => {
  const matched = pathname.match(PROJECT_PATH)
  if (!matched) {
    return projectDashboardPath(nextProjectId)
  }

  const rest = matched[2] || ""

  if (rest === "dashboard" || rest.startsWith("dashboard/")) {
    return projectDashboardPath(nextProjectId)
  }
  if (rest === "script" || rest.startsWith("script/")) {
    return projectScriptPath(nextProjectId)
  }
  if (rest === "settings" || rest === "permissions" || rest.startsWith("settings/") || rest.startsWith("permissions/")) {
    return projectSettingsPath(nextProjectId)
  }
  if (rest === "assets") {
    return projectAssetsPath(nextProjectId)
  }
  if (rest.startsWith("assets/")) {
    const tab = rest.slice("assets/".length).split("/")[0]
    return isAssetTab(tab) ? projectAssetsPath(nextProjectId, tab) : projectAssetsPath(nextProjectId)
  }
  if (isAssetTab(rest.split("/")[0])) {
    return projectAssetsPath(nextProjectId, rest.split("/")[0])
  }
  if (rest.startsWith("episode/")) {
    return projectAssetsPath(nextProjectId, "episodes")
  }
  if (rest.startsWith("workflows/")) {
    return projectDashboardPath(nextProjectId)
  }

  return projectDashboardPath(nextProjectId)
}
