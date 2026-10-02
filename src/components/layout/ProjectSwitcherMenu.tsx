import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown, MoreHorizontal, Plus } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { projectsApi } from "@/api"
import type { ProjectDTO } from "@/api/types"
import { getCurrentUser } from "@/lib/session"
import { refreshProjects, useProjectsStore } from "@/store/projectsStore"
import {
  PROJECT_ROW_ACTION_LABELS,
  PROJECT_ROW_ACTIONS,
  nextProjectAfterDelete,
  projectRowActions,
  type ProjectRowAction,
} from "@/lib/projectSwitcherMenu"
import { cn } from "@/lib/utils"

type SwitchTarget = { id: number; name: string }

interface RowMenuState {
  key: string
  top: number
  left: number
  alignUp: boolean
  project: ProjectDTO
}

interface ProjectSwitcherMenuProps {
  currentProject: SwitchTarget | null
  projects: ProjectDTO[]
  onSwitch: (project: SwitchTarget) => void
  onCreate: () => void
  onOpenSettings: () => void
  onCurrentDeleted: (next: SwitchTarget | null) => void
}

const isRowMenuTarget = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest("[data-project-row-menu]"))

export default function ProjectSwitcherMenu({
  currentProject,
  projects,
  onSwitch,
  onCreate,
  onOpenSettings,
  onCurrentDeleted,
}: ProjectSwitcherMenuProps) {
  const { notify } = useFeedback()
  const [menuOpen, setMenuOpen] = useState(false)
  const [rowMenu, setRowMenu] = useState<RowMenuState | null>(null)
  const [renameTarget, setRenameTarget] = useState<ProjectDTO | null>(null)
  const [renameName, setRenameName] = useState("")
  const [renameDescription, setRenameDescription] = useState("")
  const [renameSaving, setRenameSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ProjectDTO | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState("")
  const [deleteSaving, setDeleteSaving] = useState(false)
  const [copyingId, setCopyingId] = useState<number | null>(null)
  const user = getCurrentUser()

  useEffect(() => {
    if (!menuOpen) setRowMenu(null)
  }, [menuOpen])

  useEffect(() => {
    if (!rowMenu) return
    const onPointerDown = (event: MouseEvent) => {
      if (isRowMenuTarget(event.target)) return
      setRowMenu(null)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [rowMenu])

  const closeMenus = () => {
    setRowMenu(null)
    setMenuOpen(false)
  }

  const toggleRowMenu = (project: ProjectDTO, rect: DOMRect) => {
    const key = `project-${project.id}`
    setRowMenu((current) => {
      if (current?.key === key) return null
      const spaceBelow = window.innerHeight - rect.bottom
      const alignUp = spaceBelow < 160 && rect.top > spaceBelow
      const width = 168
      const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8)
      return {
        key,
        top: alignUp ? rect.top - 6 : rect.bottom + 6,
        left,
        alignUp,
        project,
      }
    })
  }

  const openRename = (project: ProjectDTO) => {
    closeMenus()
    setRenameTarget(project)
    setRenameName(project.name)
    setRenameDescription(project.description ?? "")
  }

  const handleRename = async () => {
    if (!renameTarget || renameSaving) return
    const name = renameName.trim()
    if (!name) {
      notify.warning("请输入项目名称")
      return
    }
    setRenameSaving(true)
    try {
      const updated = await projectsApi.update(renameTarget.id, {
        name,
        description: renameDescription.trim(),
      })
      useProjectsStore.setState({
        projects: useProjectsStore.getState().projects.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        ),
      })
      await refreshProjects()
      notify.success(`已重命名为「${updated.name}」`)
      setRenameTarget(null)
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "重命名失败")
    } finally {
      setRenameSaving(false)
    }
  }

  const handleCopy = async (project: ProjectDTO) => {
    if (copyingId != null) return
    closeMenus()
    setCopyingId(project.id)
    try {
      const copied = await projectsApi.duplicate(project.id)
      useProjectsStore.setState({
        projects: [
          copied,
          ...useProjectsStore.getState().projects.filter((item) => item.id !== copied.id),
        ],
      })
      await refreshProjects()
      notify.success(`已复制为「${copied.name}」`)
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "复制项目失败")
    } finally {
      setCopyingId(null)
    }
  }

  const openDelete = (project: ProjectDTO) => {
    closeMenus()
    setDeleteTarget(project)
    setDeleteConfirmName("")
  }

  const handleDelete = async () => {
    if (!deleteTarget || deleteSaving) return
    if (deleteConfirmName.trim() !== deleteTarget.name) return
    const deletedId = deleteTarget.id
    const deletedName = deleteTarget.name
    setDeleteSaving(true)
    try {
      await projectsApi.remove(deletedId)
      useProjectsStore.setState({
        projects: useProjectsStore.getState().projects.filter((item) => item.id !== deletedId),
      })
      await refreshProjects()
      notify.success(`已删除项目「${deletedName}」`)
      setDeleteTarget(null)
      if (currentProject?.id === deletedId) {
        const next = nextProjectAfterDelete(useProjectsStore.getState().projects, deletedId)
        onCurrentDeleted(next ? { id: next.id, name: next.name } : null)
      }
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "删除项目失败")
    } finally {
      setDeleteSaving(false)
    }
  }

  const runRowAction = (action: ProjectRowAction, project: ProjectDTO) => {
    if (action === "rename") openRename(project)
    if (action === "copy") void handleCopy(project)
    if (action === "delete") openDelete(project)
  }

  const deleteNameMatches = Boolean(deleteTarget) && deleteConfirmName.trim() === deleteTarget?.name

  return (
    <>
      <DropdownMenu
        open={menuOpen}
        onOpenChange={(next) => {
          setMenuOpen(next)
          if (!next) setRowMenu(null)
        }}
      >
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
        <DropdownMenuContent
          align="start"
          className="w-[280px] p-1.5"
          onPointerDownOutside={(event) => {
            if (isRowMenuTarget(event.target)) event.preventDefault()
          }}
          onInteractOutside={(event) => {
            if (isRowMenuTarget(event.target)) event.preventDefault()
          }}
          onFocusOutside={(event) => {
            if (isRowMenuTarget(event.target)) event.preventDefault()
          }}
        >
          <div className="px-2 py-1.5 text-xs font-medium text-[hsl(var(--secondary))]">
            切换项目
          </div>
          <DropdownMenuSeparator />
          <div
            className="max-h-72 overflow-y-auto overscroll-contain"
            onScroll={() => setRowMenu(null)}
          >
            {projects.length === 0 ? (
              <div className="px-2 py-2 text-xs text-[hsl(var(--secondary))]">
                暂无其他项目
              </div>
            ) : (
              projects.map((project) => {
                const active = project.id === currentProject?.id
                const actions = projectRowActions(project, user)
                return (
                  <div
                    key={project.id}
                    className={cn(
                      "group relative flex items-center rounded-lg",
                      active
                        ? "bg-[hsl(var(--primary))]/10"
                        : "hover:bg-[hsl(var(--surface-container-high))]",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        closeMenus()
                        onSwitch(project)
                      }}
                      className={cn(
                        "flex min-w-0 flex-1 items-center justify-between gap-2 py-2 pl-2 text-left text-sm",
                        actions.length > 0 ? "pr-9" : "pr-2",
                      )}
                    >
                      <span className={cn("truncate", active && "font-medium")}>{project.name}</span>
                      {active ? (
                        <Check className="h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
                      ) : null}
                    </button>
                    {actions.length > 0 ? (
                      <button
                        type="button"
                        data-project-row-menu=""
                        aria-label={`${project.name} 更多操作`}
                        aria-haspopup="menu"
                        aria-expanded={rowMenu?.key === `project-${project.id}`}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleRowMenu(project, event.currentTarget.getBoundingClientRect())
                        }}
                        className={cn(
                          "absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[hsl(var(--secondary))] transition-opacity hover:bg-[hsl(var(--surface-container-high))] hover:text-[hsl(var(--on-surface))]",
                          rowMenu?.key === `project-${project.id}`
                            ? "opacity-100"
                            : "opacity-60 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100",
                        )}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => {
              closeMenus()
              onCreate()
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            新建项目
          </DropdownMenuItem>
          {currentProject ? (
            <DropdownMenuItem
              className="cursor-pointer text-[hsl(var(--secondary))] focus:text-[hsl(var(--on-surface))]"
              onSelect={() => {
                closeMenus()
                onOpenSettings()
              }}
            >
              打开项目设置
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {rowMenu && menuOpen
        ? createPortal(
          <div
            data-project-row-menu=""
            role="menu"
            className="fixed z-[80] min-w-[168px] rounded-xl border border-[hsl(var(--outline-variant))]/50 bg-[hsl(var(--surface-container-lowest))] p-1 text-sm text-[hsl(var(--on-surface))] shadow-lg"
            style={{
              top: rowMenu.top,
              left: rowMenu.left,
              transform: rowMenu.alignUp ? "translateY(-100%)" : undefined,
            }}
          >
            {PROJECT_ROW_ACTIONS.map((action) => (
              <button
                key={action}
                type="button"
                role="menuitem"
                data-project-row-menu=""
                onClick={(event) => {
                  event.stopPropagation()
                  const project = rowMenu.project
                  setRowMenu(null)
                  runRowAction(action, project)
                }}
                className={cn(
                  "flex w-full items-center rounded-lg px-3 py-2 text-left transition-colors hover:bg-[hsl(var(--surface-container-low))]",
                  action === "delete" && "text-red-600",
                )}
              >
                {PROJECT_ROW_ACTION_LABELS[action]}
              </button>
            ))}
          </div>,
          document.body,
        )
        : null}

      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={(next) => {
          if (!next && !renameSaving) setRenameTarget(null)
        }}
      >
        <DialogContent className="w-full max-w-[480px] overflow-hidden rounded-2xl border-0 bg-[hsl(var(--surface))] p-0">
          <DialogHeader className="px-6 pb-2 pt-6 text-left">
            <DialogTitle className="text-xl font-bold text-[hsl(var(--on-surface))]">
              重命名项目
            </DialogTitle>
            <DialogDescription className="sr-only">修改项目名称和简短说明</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void handleRename()
            }}
          >
            <div className="space-y-5 px-6 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[hsl(var(--on-surface))]" htmlFor="project-rename-name">
                  <span className="mr-1 text-red-500">*</span>项目名称
                </label>
                <Input
                  id="project-rename-name"
                  value={renameName}
                  autoFocus
                  onChange={(event) => setRenameName(event.target.value)}
                  placeholder="请输入项目名称"
                  className="h-11 rounded-xl border-none bg-[hsl(var(--surface-container-low))] text-sm placeholder:text-[hsl(var(--secondary))] focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[hsl(var(--on-surface))]" htmlFor="project-rename-description">
                  简短说明
                </label>
                <Textarea
                  id="project-rename-description"
                  value={renameDescription}
                  onChange={(event) => setRenameDescription(event.target.value)}
                  placeholder="可选，一句话介绍这个项目"
                  rows={3}
                  className="resize-none rounded-xl border-none bg-[hsl(var(--surface-container-low))] text-sm placeholder:text-[hsl(var(--secondary))] focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))]"
                />
              </div>
            </div>
            <div className="px-6 pb-6 pt-2">
              <Button
                type="submit"
                disabled={renameSaving}
                className="h-11 w-full rounded-xl border-0 text-base font-bold text-white signature-gradient"
              >
                {renameSaving ? "保存中..." : "保存"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => {
          if (!next && !deleteSaving) setDeleteTarget(null)
        }}
      >
        <DialogContent className="w-full max-w-[480px] overflow-hidden rounded-2xl border-0 bg-[hsl(var(--surface))] p-0">
          <DialogHeader className="px-6 pb-2 pt-6 text-left">
            <DialogTitle className="text-xl font-bold text-[hsl(var(--on-surface))]">
              删除项目
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm leading-6 text-[hsl(var(--secondary))]">
              此操作不可恢复。项目「{deleteTarget?.name}」中的剧集、资产和工作流会被一并清除。
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void handleDelete()
            }}
          >
            <div className="space-y-2 px-6 py-4">
              <label className="text-sm font-medium text-[hsl(var(--on-surface))]" htmlFor="project-delete-confirm">
                请输入项目名称「{deleteTarget?.name}」以确认
              </label>
              <Input
                id="project-delete-confirm"
                value={deleteConfirmName}
                autoComplete="off"
                onChange={(event) => setDeleteConfirmName(event.target.value)}
                placeholder={deleteTarget?.name}
                className="h-11 rounded-xl border-none bg-[hsl(var(--surface-container-low))] text-sm placeholder:text-[hsl(var(--secondary))] focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))]"
              />
            </div>
            <div className="flex gap-3 px-6 pb-6 pt-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 rounded-xl"
                disabled={deleteSaving}
                onClick={() => setDeleteTarget(null)}
              >
                取消
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="h-11 flex-1 rounded-xl font-bold"
                disabled={deleteSaving || !deleteNameMatches}
              >
                {deleteSaving ? "删除中..." : "删除项目"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
