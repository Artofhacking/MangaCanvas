import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { 
  LayoutGrid, 
  Settings,
  ChevronDown,
  Plus,
  Check,
  Loader2,
  Box,
  ScrollText,
  Shield,
  Star,
  Clapperboard,
} from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useEffect, useMemo, useRef, useState } from "react"
import ApiSettings from "@/features/infinite-canvas/components/ApiSettings"
import ProjectCreator from "@/pages/ProjectCreator"
import {
  getActiveProjectId,
  setActiveProjectId,
  getCurrentUser,
} from "@/lib/session"
import { useProjectsStore, refreshProjects } from "@/store/projectsStore"
import { projectsApi } from "@/api"
import { episodesApi } from "@/api/projectApi"
import {
  projectAssetsPath,
  projectDashboardPath,
  projectEpisodePath,
  projectScriptPath,
  projectSettingsPath,
  switchProjectPath,
} from "@/lib/workspaceRoutes"
import {
  episodeIdFromPath,
  formatEpisodeNavLabel,
  isProjectFavoritesPath,
  resolveProjectSidebarSection,
  sortEpisodesForNav,
} from "@/lib/sidebarNav"
import { useProjectStore } from "@/store/projectStore"
import type { Episode } from "@/types"
import { APP_HOME_PATH } from "@/lib/appHome"
import { cn } from "@/lib/utils"

const getProjectIdFromPath = (pathname: string) => {
  const matched = pathname.match(/^\/project\/(\d+)/)
  return matched ? Number(matched[1]) : null
}

export default function Sidebar() {
  const [currentProject, setCurrentProject] = useState<{ id: number; name: string } | null>(null)
  const [isSwitching, setIsSwitching] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isProjectCreatorOpen, setIsProjectCreatorOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const routeProjectId = getProjectIdFromPath(location.pathname)
  const inProjectShell = Boolean(routeProjectId)
  const activeProjectId = routeProjectId ?? currentProject?.id ?? getActiveProjectId() ?? undefined
  const { projects: allProjects, isLoaded, fetchProjects } = useProjectsStore()
  const projects = allProjects.map((project) => ({ id: project.id, name: project.name }))

  useEffect(() => {
    if (!isLoaded) {
      void fetchProjects()
    }
  }, [isLoaded, fetchProjects])

  useEffect(() => {
    if (projects.length === 0) return

    const preferredId = routeProjectId ?? getActiveProjectId() ?? projects[0]?.id
    const matched = projects.find((project) => project.id === preferredId) || projects[0] || null

    if (matched && (!currentProject || currentProject.id !== matched.id)) {
      setCurrentProject(matched)
      if (routeProjectId && matched.id === routeProjectId) {
        setActiveProjectId(matched.id)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeProjectId, isLoaded, allProjects])

  const switchToProject = (project: { id: number; name: string }) => {
    if (project.id === currentProject?.id) return
    setIsSwitching(true)
    setCurrentProject(project)
    setActiveProjectId(project.id)
    const target = inProjectShell
      ? switchProjectPath(location.pathname, project.id)
      : projectDashboardPath(project.id)
    window.setTimeout(() => {
      setIsSwitching(false)
      navigate(target, { replace: true })
    }, 300)
  }

  const sidebarSection = resolveProjectSidebarSection(location.pathname)
  const isFavoritesPath = isProjectFavoritesPath(location.pathname)
  const currentEpisodeId = episodeIdFromPath(location.pathname)
  const onEpisodeRoute = currentEpisodeId != null
  const [episodesExpanded, setEpisodesExpanded] = useState(true)
  const previousOnEpisodeRoute = useRef(false)
  const fetchGeneration = useRef(0)
  const storeEpisodes = useProjectStore((state) => state.assets.episodes)
  const initializedProjectId = useProjectStore((state) => state.initializedProjectId)
  const storeError = useProjectStore((state) => state.error)
  const [episodeNav, setEpisodeNav] = useState<{
    projectId: number | null
    episodes: Episode[]
    ready: boolean
    failed: boolean
  }>({ projectId: null, episodes: [], ready: false, failed: false })

  useEffect(() => {
    if (onEpisodeRoute && !previousOnEpisodeRoute.current) {
      setEpisodesExpanded(true)
    }
    previousOnEpisodeRoute.current = onEpisodeRoute
  }, [onEpisodeRoute])

  useEffect(() => {
    setEpisodesExpanded(true)
  }, [activeProjectId])

  useEffect(() => {
    if (!inProjectShell || activeProjectId == null) return
    if (initializedProjectId !== activeProjectId || storeError) return
    fetchGeneration.current += 1
    setEpisodeNav({
      projectId: activeProjectId,
      episodes: storeEpisodes,
      ready: true,
      failed: false,
    })
  }, [activeProjectId, inProjectShell, initializedProjectId, storeEpisodes, storeError])

  useEffect(() => {
    if (!inProjectShell || activeProjectId == null) {
      setEpisodeNav({ projectId: null, episodes: [], ready: false, failed: false })
      return
    }

    const generation = ++fetchGeneration.current
    const projectId = activeProjectId
    let cancelled = false
    void episodesApi.getAll(projectId).then((response) => {
      if (cancelled || fetchGeneration.current !== generation) return
      setEpisodeNav((current) => {
        const kept = !response.success && current.projectId === projectId ? current.episodes : []
        const episodes = response.success ? response.data || [] : kept
        return {
          projectId,
          episodes,
          ready: true,
          failed: !response.success && episodes.length === 0,
        }
      })
    }).catch(() => {
      if (cancelled || fetchGeneration.current !== generation) return
      setEpisodeNav((current) => ({
        projectId,
        episodes: current.projectId === projectId ? current.episodes : [],
        ready: true,
        failed: current.projectId !== projectId || current.episodes.length === 0,
      }))
    })

    return () => {
      cancelled = true
    }
  }, [activeProjectId, inProjectShell, sidebarSection])

  const visibleEpisodes = useMemo(
    () => sortEpisodesForNav(episodeNav.projectId === activeProjectId ? episodeNav.episodes : []),
    [activeProjectId, episodeNav.episodes, episodeNav.projectId]
  )
  const episodesReady = episodeNav.ready && episodeNav.projectId === activeProjectId

  const navClass = (active: boolean) =>
    `flex min-h-[38px] items-center gap-2.5 rounded-lg px-3 py-2 text-sm leading-5 transition-colors ${
      active
        ? "bg-[hsl(var(--surface-container-high))] font-medium text-[hsl(var(--primary))]"
        : "text-[hsl(var(--on-secondary-fixed-variant))] hover:bg-[hsl(var(--surface-container-high))]"
    }`

  return (
    <>
      {isSwitching && (
        <div className="fixed inset-0 z-[100] bg-[hsl(var(--surface))]/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-[hsl(var(--primary))] animate-spin" />
            <p className="text-sm text-[hsl(var(--on-surface))] font-medium">正在切换项目...</p>
          </div>
        </div>
      )}
      <aside className="fixed left-0 top-0 z-50 flex h-screen w-64 flex-col gap-y-2 bg-[hsl(var(--surface-container-low))] px-3.5 py-4">
        {inProjectShell ? (
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="group w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[hsl(var(--surface-container-high))]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h1 className="cn-keep truncate text-[15px] font-semibold leading-snug text-[hsl(var(--on-surface))]">
                        {currentProject?.name || "未选择项目"}
                      </h1>
                      <p className="text-xs leading-4 text-[hsl(var(--secondary))]">当前项目</p>
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0 text-[hsl(var(--secondary))] group-hover:text-[hsl(var(--on-surface))]" />
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <div className="px-2 py-1.5 text-xs font-medium text-[hsl(var(--secondary))]">
                  切换项目
                </div>
                <DropdownMenuSeparator />
                {projects.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-[hsl(var(--secondary))]">
                    暂无其他项目
                  </div>
                ) : (
                  projects.map((project) => (
                    <DropdownMenuItem
                      key={project.id}
                      onClick={() => switchToProject(project)}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <span className={project.id === currentProject?.id ? "font-medium" : ""}>
                        {project.name}
                      </span>
                      {project.id === currentProject?.id && (
                        <Check className="w-4 h-4 text-[hsl(var(--primary))]" />
                      )}
                    </DropdownMenuItem>
                  ))
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => setIsProjectCreatorOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  新建项目
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="px-3 py-1.5">
            <h1 className="text-[15px] font-semibold leading-snug text-[hsl(var(--on-surface))]">MangaCanvas</h1>
            <p className="text-xs leading-4 text-[hsl(var(--secondary))]">工作区</p>
          </div>
        )}

        <nav className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
          {inProjectShell ? (
            <>
              <Link
                to={activeProjectId ? projectDashboardPath(activeProjectId) : APP_HOME_PATH}
                className={navClass(sidebarSection === "workbench")}
              >
                <LayoutGrid className="h-[18px] w-[18px]" />
                <span>工作台</span>
              </Link>
              {activeProjectId ? (
                <Link
                  to={projectScriptPath(activeProjectId)}
                  className={navClass(sidebarSection === "script")}
                >
                  <ScrollText className="h-[18px] w-[18px]" />
                  <span>剧本</span>
                </Link>
              ) : null}
              {activeProjectId ? (
                <div>
                  <button
                    type="button"
                    className={`${navClass(sidebarSection === "episodes")} w-full text-left`}
                    aria-expanded={episodesExpanded}
                    aria-controls="sidebar-episode-list"
                    onClick={() => setEpisodesExpanded((open) => !open)}
                  >
                    <Clapperboard className="h-[18px] w-[18px]" />
                    <span className="flex-1">剧集</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 opacity-70 transition-transform ${episodesExpanded ? "" : "-rotate-90"}`}
                    />
                  </button>
                  {episodesExpanded ? (
                    <div id="sidebar-episode-list" className="mt-1 space-y-1">
                      {!episodesReady ? (
                        <p className="py-1 pl-11 pr-2 text-xs leading-5 text-[hsl(var(--secondary))]">加载中</p>
                      ) : null}
                      {episodesReady && episodeNav.failed && visibleEpisodes.length === 0 ? (
                        <p className="py-1 pl-11 pr-2 text-xs leading-5 text-[hsl(var(--secondary))]">剧集加载失败</p>
                      ) : null}
                      {episodesReady && !episodeNav.failed && visibleEpisodes.length === 0 ? (
                        <div className="py-1 pl-11 pr-2">
                          <p className="text-xs leading-5 text-[hsl(var(--secondary))]">暂无剧集</p>
                          <Link
                            to={projectScriptPath(activeProjectId)}
                            className="text-xs font-medium leading-5 text-[hsl(var(--primary))]"
                          >
                            去剧本创建
                          </Link>
                        </div>
                      ) : null}
                      {episodesReady && !episodeNav.failed
                        ? visibleEpisodes.map((episode, index) => {
                            const { label, fullLabel } = formatEpisodeNavLabel(episode, index + 1)
                            const active = currentEpisodeId === episode.id
                            return (
                              <Link
                                key={episode.id}
                                to={projectEpisodePath(activeProjectId, episode.id)}
                                title={fullLabel}
                                className={cn(navClass(active), "min-w-0 pl-11")}
                              >
                                <span className="truncate">{label}</span>
                              </Link>
                            )
                          })
                        : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {activeProjectId ? (
                <div>
                  <Link
                    to={projectAssetsPath(activeProjectId)}
                    className={navClass(sidebarSection === "assets" && !isFavoritesPath)}
                  >
                    <Box className="h-[18px] w-[18px]" />
                    <span>资产</span>
                  </Link>
                  <Link
                    to={projectAssetsPath(activeProjectId, "favorites")}
                    className={`${navClass(isFavoritesPath)} mt-1 pl-11`}
                  >
                    <Star className="h-4 w-4" />
                    <span>我的收藏</span>
                  </Link>
                </div>
              ) : null}
              {activeProjectId ? (
                <>
                  <div className="my-2.5 border-t border-[hsl(var(--outline-variant))]/30" />
                  <Link
                    to={projectSettingsPath(activeProjectId)}
                    className={navClass(sidebarSection === "settings")}
                  >
                    <Shield className="h-[18px] w-[18px]" />
                    <span>项目设置</span>
                  </Link>
                </>
              ) : null}
            </>
          ) : (
            <>
              <Link
                to={APP_HOME_PATH}
                className={navClass(location.pathname === APP_HOME_PATH)}
              >
                <LayoutGrid className="h-[18px] w-[18px]" />
                <span>工作台</span>
              </Link>
              <button
                type="button"
                onClick={() => setIsProjectCreatorOpen(true)}
                className={`${navClass(false)} w-full text-left`}
              >
                <Plus className="h-[18px] w-[18px]" />
                <span>新建项目</span>
              </button>
            </>
          )}
        </nav>

        <div className="mt-3 border-t border-[hsl(var(--outline-variant))]/30 pt-3">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className={`${navClass(false)} w-full text-left`}
          >
            <Settings className="h-[18px] w-[18px]" />
            <span>设置</span>
          </button>
        </div>
      </aside>

      <ApiSettings visible={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <ProjectCreator
        open={isProjectCreatorOpen}
        onOpenChange={setIsProjectCreatorOpen}
        onCreate={async (project) => {
          try {
            const user = getCurrentUser()
            const organizationId = user?.organizationIds?.[0] ?? 1
            const created = await projectsApi.create({
              organizationId,
              name: project.name,
              description: project.description,
              isPublic: false,
            })
            await refreshProjects()
            setIsProjectCreatorOpen(false)
            setActiveProjectId(created.id)
            navigate(projectDashboardPath(created.id))
          } catch (error) {
            console.error("创建项目失败:", error)
          }
        }}
      />
    </>
  )
}
