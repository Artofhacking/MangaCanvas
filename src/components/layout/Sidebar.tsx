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
} from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"
import ApiSettings from "@/features/infinite-canvas/components/ApiSettings"
import ProjectCreator from "@/pages/ProjectCreator"
import {
  getActiveProjectId,
  setActiveProjectId,
  getCurrentUser,
} from "@/lib/session"
import { useProjectsStore, refreshProjects } from "@/store/projectsStore"
import { projectsApi } from "@/api"
import {
  projectAssetsPath,
  projectDashboardPath,
  projectScriptPath,
  projectSettingsPath,
  switchProjectPath,
} from "@/lib/workspaceRoutes"
import { APP_HOME_PATH } from "@/lib/appHome"

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

  const projectNav = activeProjectId
    ? [
        { icon: LayoutGrid, label: "工作台", href: projectDashboardPath(activeProjectId) },
        { icon: ScrollText, label: "剧本", href: projectScriptPath(activeProjectId) },
        { icon: Box, label: "资产", href: projectAssetsPath(activeProjectId) },
      ]
    : []

  const isWorkbenchPath =
    /^\/project\/\d+\/dashboard$/.test(location.pathname) ||
    /\/workflows\//.test(location.pathname) ||
    /\/episode\/\d+\/canvas$/.test(location.pathname)
  const isScriptPath = /\/project\/\d+\/script(?:\/|$)/.test(location.pathname)
  const isAssetsPath =
    /\/project\/\d+\/assets(?:\/|$)/.test(location.pathname) ||
    /\/project\/\d+\/episode\/\d+(?:\/|$)/.test(location.pathname)
  const isSettingsPath = /\/project\/\d+\/(settings|permissions)(?:\/|$)/.test(location.pathname)
  const isFavoritesPath = /\/project\/\d+\/assets\/favorites(?:\/|$)/.test(location.pathname)

  const navClass = (active: boolean) =>
    `flex min-h-8 items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] leading-5 transition-colors ${
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
      <aside className="fixed left-0 top-0 z-50 flex h-screen w-64 flex-col gap-y-1.5 bg-[hsl(var(--surface-container-low))] px-3 py-3">
        {inProjectShell ? (
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="group w-full rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[hsl(var(--surface-container-high))]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h1 className="cn-keep truncate text-sm font-semibold leading-5 text-[hsl(var(--on-surface))]">
                        {currentProject?.name || "未选择项目"}
                      </h1>
                      <p className="text-[11px] leading-4 text-[hsl(var(--secondary))]">当前项目</p>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--secondary))] group-hover:text-[hsl(var(--on-surface))]" />
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
          <div className="px-2.5 py-1">
            <h1 className="text-sm font-semibold leading-5 text-[hsl(var(--on-surface))]">MangaCanvas</h1>
            <p className="text-[11px] leading-4 text-[hsl(var(--secondary))]">工作区</p>
          </div>
        )}

        <nav className="flex-1 space-y-0.5">
          {inProjectShell ? (
            <>
              {projectNav.map((item) => {
                const isActive =
                  (item.label === "工作台" && isWorkbenchPath) ||
                  (item.label === "剧本" && isScriptPath) ||
                  (item.label === "资产" && isAssetsPath && !isWorkbenchPath && !isScriptPath)
                return (
                  <div key={item.label}>
                    <Link to={item.href} className={navClass(isActive && !isFavoritesPath)}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                    {item.label === "资产" && activeProjectId ? (
                      <Link
                        to={projectAssetsPath(activeProjectId, "favorites")}
                        className={`${navClass(isFavoritesPath)} mt-0.5 pl-9`}
                      >
                        <Star className="h-3.5 w-3.5" />
                        <span>我的收藏</span>
                      </Link>
                    ) : null}
                  </div>
                )
              })}
              {activeProjectId ? (
                <>
                  <div className="my-1.5 border-t border-[hsl(var(--outline-variant))]/30" />
                  <Link
                    to={projectSettingsPath(activeProjectId)}
                    className={navClass(isSettingsPath)}
                  >
                    <Shield className="h-4 w-4" />
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
                <LayoutGrid className="h-4 w-4" />
                <span>工作台</span>
              </Link>
              <button
                type="button"
                onClick={() => setIsProjectCreatorOpen(true)}
                className={`${navClass(false)} w-full text-left`}
              >
                <Plus className="h-4 w-4" />
                <span>新建项目</span>
              </button>
            </>
          )}
        </nav>

        <div className="mt-2 border-t border-[hsl(var(--outline-variant))]/30 pt-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className={`${navClass(false)} w-full text-left`}
          >
            <Settings className="h-4 w-4" />
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
