import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Pagination } from "@/components/ui/pagination"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import NotificationDrawer, { demoNotifications } from "@/components/layout/NotificationDrawer"
import UserProfileMenu from "@/components/layout/UserProfileMenu"
import { Plus, ChevronLeft, Bell, Filter, MoreVertical, Pencil, Trash2 } from "lucide-react"
import { useNavigate, Link } from "react-router-dom"
import { useEffect, useState } from "react"
import ProjectCreator from "./ProjectCreator"
import ProjectEditor, { type EditableProject } from "./ProjectEditor"
import Sidebar from "@/components/layout/Sidebar"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { projectsApi } from "@/api"
import {
  getCurrentUser,
  setActiveProjectId,
  IDENTITY_CHANGE_EVENT,
  getIdentityMeta,
  getStoredIdentity,
  type IdentityOption,
} from "@/lib/session"
import { mapProjectCard } from "@/lib/projectMappers"

interface Project {
  id: number
  organizationId?: number
  name: string
  description?: string
  image: string
  status: "in-progress" | "completed" | "draft"
  modified: string
  code: string
  assetCount: number
}

type ProjectStatus = "all" | "draft" | "in-progress" | "completed"

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "draft", label: "草稿" },
  { value: "in-progress", label: "进行中" },
  { value: "completed", label: "已完成" },
]

export default function ProjectsList() {
  const navigate = useNavigate()
  const { notify } = useFeedback()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false)
  const [isProjectEditorOpen, setIsProjectEditorOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<EditableProject | null>(null)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notificationList, setNotificationList] = useState(demoNotifications)
  const [currentIdentity, setCurrentIdentity] = useState<IdentityOption>(getStoredIdentity)
  
  // 分页和筛选状态
  const [page, setPage] = useState(1)
  const [size] = useState(12)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<ProjectStatus>("all")
  
  // 删除对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingProject, setDeletingProject] = useState<Project | null>(null)
  
  const unreadCount = notificationList.filter((item) => !item.read).length
  const currentIdentityMeta = getIdentityMeta(currentIdentity)
  const visibleProjects = currentIdentityMeta.hasProjects ? projects : []

  const loadProjects = async () => {
    setIsLoading(true)
    try {
      const user = getCurrentUser()
      const organizationId = user?.organizationIds?.[0]
      const params: { page: number; size: number; organizationId?: number; status?: "draft" | "in-progress" | "completed" } = { 
        page, 
        size, 
        organizationId 
      }
      if (statusFilter !== "all") {
        params.status = statusFilter as "draft" | "in-progress" | "completed"
      }
      const response = await projectsApi.list(params)
      setProjects(response.list.map((project) => mapProjectCard(project)))
      setTotal(response.pagination?.total ?? response.list.length)
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "加载项目列表失败")
    } finally {
      setIsLoading(false)
    }
  }

  // 当分页或筛选条件变化时重新加载
  useEffect(() => {
    if (currentIdentityMeta.hasProjects) {
      void loadProjects()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter])

  const handleProjectClick = (projectId: number) => {
    setActiveProjectId(projectId)
    navigate(`/project/${projectId}`)
  }

  const handleCreateProject = async (data: {
    name: string
    password?: string
    mode: string
    description: string
    scriptFile?: File | null
  }) => {
    try {
      const user = getCurrentUser()
      const organizationId = user?.organizationIds?.[0]
      if (!organizationId) {
        notify.error("当前账号缺少组织信息，无法创建项目")
        return
      }

      const project = await projectsApi.create({
        organizationId,
        name: data.name,
        description: data.description,
        coverImage: null,
        isPublic: false,
      })
      const mapped = mapProjectCard(project)
      setProjects((prev) => [mapped, ...prev])
      notify.success(`已创建项目：${mapped.name}`)
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "创建项目失败")
    }
  }

  const handleSaveProject = async (updatedProject: EditableProject) => {
    try {
      const project = await projectsApi.update(updatedProject.id, {
        name: updatedProject.name,
        description: updatedProject.description,
        coverImage: updatedProject.image,
        status: updatedProject.status,
      })
      const mapped = mapProjectCard(project)
      setProjects((prev) => prev.map((item) => (item.id === mapped.id ? mapped : item)))
      setEditingProject(mapped)
      notify.success(`已更新项目：${mapped.name}`)
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "更新项目失败")
    }
  }

  const handleDeleteProject = async () => {
    if (!deletingProject) return
    try {
      await projectsApi.remove(deletingProject.id)
      setProjects((prev) => prev.filter((item) => item.id !== deletingProject.id))
      setTotal((prev) => prev - 1)
      notify.success(`已删除项目：${deletingProject.name}`)
      setDeleteDialogOpen(false)
      setDeletingProject(null)
      // 触发项目列表刷新事件，通知 Sidebar 更新
      window.dispatchEvent(new CustomEvent('projects:refresh'))
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "删除项目失败")
    }
  }

  const openEditDialog = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingProject({
      id: project.id,
      name: project.name,
      description: project.description || "",
      image: project.image,
      status: project.status,
      modified: project.modified,
      code: project.code,
      assetCount: project.assetCount,
    })
    setIsProjectEditorOpen(true)
  }

  const openDeleteDialog = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingProject(project)
    setDeleteDialogOpen(true)
  }

  const markAllAsRead = () => {
    setNotificationList((current) => current.map((item) => ({ ...item, read: true })))
  }

  const markAsRead = (id: number) => {
    setNotificationList((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)))
  }

  // 身份切换监听
  useEffect(() => {
    const syncIdentity = () => setCurrentIdentity(getStoredIdentity())
    const handleIdentityChange = (event: Event) => {
      const nextIdentity = (event as CustomEvent<IdentityOption>).detail
      if (nextIdentity) {
        setCurrentIdentity(nextIdentity)
        return
      }
      syncIdentity()
    }

    window.addEventListener(IDENTITY_CHANGE_EVENT, handleIdentityChange as EventListener)
    window.addEventListener("storage", syncIdentity)

    return () => {
      window.removeEventListener(IDENTITY_CHANGE_EVENT, handleIdentityChange as EventListener)
      window.removeEventListener("storage", syncIdentity)
    }
  }, [])

  return (
    <>
    <div className="workspace-shell h-screen overflow-hidden bg-[hsl(var(--surface))]">
      <ProjectCreator
        open={isProjectDialogOpen}
        onOpenChange={setIsProjectDialogOpen}
        onCreate={handleCreateProject}
      />
      <ProjectEditor
        open={isProjectEditorOpen}
        onOpenChange={setIsProjectEditorOpen}
        project={editingProject}
        onSave={handleSaveProject}
      />

      <Sidebar />

      <main className="relative ml-64 h-screen flex flex-col overflow-hidden">
        {/* Header */}
        <header className="workspace-fixed-header fixed top-0 z-40 flex h-16 items-center justify-between border-b border-[hsl(var(--outline-variant))]/15 bg-[hsl(var(--surface-container-lowest))]/80 px-8 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="text-[hsl(var(--secondary))] hover:text-[hsl(var(--on-surface))]"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="text-lg font-black text-[hsl(var(--on-surface))]">项目列表</span>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setNotificationOpen(true)}
              className="relative text-[hsl(var(--secondary))] hover:text-[hsl(var(--on-surface))]"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 ? (
                <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[hsl(var(--primary))] px-1 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              ) : null}
            </Button>

            <div className="h-4 w-px bg-[hsl(var(--outline-variant))]" />

            <UserProfileMenu />
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 pt-24">
          {/* 筛选栏 */}
          <div className="flex items-center gap-2 mb-6">
            <Filter className="h-4 w-4 text-[hsl(var(--secondary))]" />
            <span className="text-sm text-[hsl(var(--secondary))] mr-2">状态筛选:</span>
            <div className="flex gap-1">
              {STATUS_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={statusFilter === option.value ? "default" : "ghost"}
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setStatusFilter(option.value)
                    setPage(1)
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Add New Project Card */}
            <div
              onClick={() => setIsProjectDialogOpen(true)}
              className="aspect-[4/3] bg-[hsl(var(--surface-container))] border-2 border-dashed border-[hsl(var(--outline-variant))] flex flex-col items-center justify-center rounded-xl hover:bg-[hsl(var(--surface-container-low))] transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-full bg-[hsl(var(--surface-container-high))] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6 text-[hsl(var(--primary))]" />
              </div>
              <span className="text-sm font-bold text-[hsl(var(--on-surface-variant))]">新建项目</span>
              <span className="text-[10px] text-[hsl(var(--secondary))] mt-1 uppercase tracking-tighter">
                开始新的创作
              </span>
            </div>

            {/* Project Cards */}
            {isLoading ? (
              <div className="col-span-full rounded-xl bg-[hsl(var(--surface-container-lowest))] p-6 text-sm text-[hsl(var(--secondary))]">
                正在加载项目列表...
              </div>
            ) : null}
            {visibleProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => handleProjectClick(project.id)}
                className="group relative bg-[hsl(var(--surface-container-lowest))] rounded-xl overflow-hidden hover:shadow-xl hover:shadow-[hsl(var(--on-surface))]/5 transition-all hover:-translate-y-1 cursor-pointer"
              >
                <div className="aspect-[4/3] w-full relative overflow-hidden">
                  <img
                    src={project.image}
                    alt={project.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute top-3 left-3 flex gap-2">
                    <Badge
                      className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase border-0 ${
                        project.status === "completed"
                          ? "bg-emerald-500 text-white"
                          : project.status === "in-progress"
                          ? "bg-[hsl(var(--primary))] text-white"
                          : "bg-[hsl(var(--surface-container-highest))] text-[hsl(var(--on-secondary-fixed-variant))]"
                      }`}
                    >
                      {project.status === "completed"
                        ? "已完成"
                        : project.status === "in-progress"
                        ? "进行中"
                        : "草稿"}
                    </Badge>
                  </div>
                  {/* 操作菜单 */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 bg-black/20 hover:bg-black/40 text-white"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => openEditDialog(project, e as unknown as React.MouseEvent)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={(e) => openDeleteDialog(project, e as unknown as React.MouseEvent)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-extrabold text-[hsl(var(--on-surface))] mb-1">
                    {project.name}
                  </h3>
                  {project.description && (
                    <p className="text-[10px] text-[hsl(var(--secondary))] mb-2 line-clamp-1">
                      {project.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[hsl(var(--secondary))] font-medium">
                      {project.assetCount} 个资源 · 修改于 {project.modified}
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] bg-[hsl(var(--secondary-container))] text-[hsl(var(--on-secondary-container))] px-2 py-0.5 rounded-full font-bold border-0"
                    >
                      {project.code}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}

            {!currentIdentityMeta.hasProjects ? (
              <div className="col-span-full flex min-h-[320px] flex-col items-center justify-center rounded-[28px] border border-dashed border-[hsl(var(--outline-variant))]/40 bg-[hsl(var(--surface-container-lowest))] px-8 text-center">
                <div className="rounded-full bg-[hsl(var(--surface-container-high))] px-4 py-1.5 text-[11px] font-bold tracking-[0.18em] text-[hsl(var(--secondary))]">
                  {currentIdentityMeta.label}
                </div>
                <h3 className="mt-5 text-2xl font-black text-[hsl(var(--on-surface))]">当前身份下还没有项目</h3>
                <p className="mt-3 max-w-md text-sm text-[hsl(var(--secondary))]">
                  这个身份用于模拟刚加入系统的新成员视角。你可以切换回“创作者”、“管理员”或“项目统筹”查看已有项目。
                </p>
              </div>
            ) : null}
          </div>

          {/* 分页 */}
          {currentIdentityMeta.hasProjects && total > 0 && (
            <Pagination
              page={page}
              size={size}
              total={total}
              onPageChange={setPage}
            />
          )}
        </div>

        {/* Footer */}
        <footer className="py-6 border-t border-[hsl(var(--outline-variant))]/15 bg-[hsl(var(--surface))] shrink-0">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <span className="text-sm font-bold text-[hsl(var(--on-surface))]">MangaCanvas</span>
              <p className="text-xs text-[hsl(var(--on-secondary-fixed-variant))] mt-1">© 2024 Kinetic Gallery. 保留所有权利。</p>
            </div>
            <div className="flex gap-6">
              <Link to="/privacy" className="text-xs text-[hsl(var(--secondary))] hover:text-[hsl(var(--primary))] transition-colors">
                隐私政策
              </Link>
              <Link to="/terms" className="text-xs text-[hsl(var(--secondary))] hover:text-[hsl(var(--primary))] transition-colors">
                服务条款
              </Link>
              <Link to="/contact" className="text-xs text-[hsl(var(--secondary))] hover:text-[hsl(var(--primary))] transition-colors">
                联系我们
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>

    {/* 删除确认对话框 */}
    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除项目</DialogTitle>
          <DialogDescription>
            您确定要删除项目 <strong>{deletingProject?.name}</strong> 吗？此操作不可恢复。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
            取消
          </Button>
          <Button variant="destructive" onClick={handleDeleteProject}>
            删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <NotificationDrawer
      open={notificationOpen}
      onOpenChange={setNotificationOpen}
      notifications={notificationList}
      onMarkAllAsRead={markAllAsRead}
      onMarkAsRead={markAsRead}
      onClearAll={() => setNotificationList([])}
    />
    </>
  )
}
