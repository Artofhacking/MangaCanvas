export const ASSET_TABS = ["episodes", "characters", "scenes", "objects", "workflows", "favorites"] as const

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

export const projectEpisodePath = (projectId: number | string, episodeId: number | string) =>
  `/project/${projectId}/episode/${episodeId}`

export const projectEpisodeStoryboardPath = (projectId: number | string, episodeId: number | string) =>
  `/project/${projectId}/episode/${episodeId}?view=storyboard`

export type WorkflowCanvasEntry =
  | "workflows"
  | "episodes"
  | "scenes"
  | "characters"
  | "objects"
  | "episode"
  | "dashboard"

export type WorkflowCanvasNavState = {
  from?: WorkflowCanvasEntry
  returnTo?: string
}

const canvasReturnStorageKey = (projectId: string, workflowId: string) =>
  `mc.workflowReturn.${projectId}.${workflowId}`

export const workflowCanvasNavState = (
  returnTo?: string,
  from?: WorkflowCanvasEntry
): WorkflowCanvasNavState | undefined => {
  if (!returnTo && !from) return undefined
  return {
    ...(from ? { from } : {}),
    ...(returnTo ? { returnTo } : {}),
  }
}

export const readWorkflowCanvasNavState = (state: unknown): WorkflowCanvasNavState | undefined => {
  if (!state || typeof state !== "object") return undefined
  const { from, returnTo } = state as WorkflowCanvasNavState
  const next: WorkflowCanvasNavState = {}
  if (
    from === "workflows" ||
    from === "episodes" ||
    from === "scenes" ||
    from === "characters" ||
    from === "objects" ||
    from === "episode" ||
    from === "dashboard"
  ) {
    next.from = from
  }
  if (typeof returnTo === "string" && returnTo.startsWith("/")) {
    next.returnTo = returnTo
  }
  return next.from || next.returnTo ? next : undefined
}

export const readWorkflowCanvasReturnTo = (state: unknown): string | undefined =>
  readWorkflowCanvasNavState(state)?.returnTo

export const persistWorkflowCanvasNavState = (
  projectId: string | undefined,
  workflowId: string | undefined,
  state: WorkflowCanvasNavState | undefined
) => {
  if (!projectId || !workflowId || typeof sessionStorage === "undefined") return
  const key = canvasReturnStorageKey(projectId, workflowId)
  if (!state?.from && !state?.returnTo) {
    sessionStorage.removeItem(key)
    return
  }
  sessionStorage.setItem(key, JSON.stringify(state))
}

export const loadWorkflowCanvasNavState = (
  projectId: string | undefined,
  workflowId: string | undefined
): WorkflowCanvasNavState | undefined => {
  if (!projectId || !workflowId || typeof sessionStorage === "undefined") return undefined
  try {
    return readWorkflowCanvasNavState(JSON.parse(sessionStorage.getItem(canvasReturnStorageKey(projectId, workflowId)) || "null"))
  } catch {
    return undefined
  }
}

const isSameProjectPath = (projectId: string, path: string) => path.startsWith(`/project/${projectId}/`)

const pathForCanvasEntry = (projectId: string, from: WorkflowCanvasEntry | undefined) => {
  switch (from) {
    case "workflows":
      return projectAssetsPath(projectId, "workflows")
    case "episodes":
      return projectAssetsPath(projectId, "episodes")
    case "scenes":
      return projectAssetsPath(projectId, "scenes")
    case "characters":
      return projectAssetsPath(projectId, "characters")
    case "objects":
      return projectAssetsPath(projectId, "objects")
    case "dashboard":
      return projectDashboardPath(projectId)
    default:
      return undefined
  }
}

/** Generic canvas back. `from=workflows` always returns to the list, ignoring sourceType. */
export const resolveWorkflowCanvasReturnTo = (
  projectId: string | undefined,
  state: unknown,
  workflowId?: string
) => {
  if (!projectId) return "/projects"
  const nav = readWorkflowCanvasNavState(state) ?? loadWorkflowCanvasNavState(projectId, workflowId)

  if (nav?.from === "workflows") {
    return projectAssetsPath(projectId, "workflows")
  }

  if (nav?.returnTo && isSameProjectPath(projectId, nav.returnTo)) {
    return nav.returnTo
  }

  return pathForCanvasEntry(projectId, nav?.from) ?? projectAssetsPath(projectId, "workflows")
}

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
