/**
 * ProjectDetail - 项目工作台
 * 
 * 重构后职责：
 * 1. 页面布局容器（Sidebar + Header + Content）
 * 2. 弹框/抽屉的渲染控制
 * 3. Tab 切换路由
 * 
 * 状态管理已迁移至：
 * - projectStore.ts: 资产数据（episodes/scenes/characters/objects）
 */

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, ChevronLeft, ChevronRight, Trash2, Upload } from "lucide-react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import Sidebar from "@/components/layout/Sidebar"
import ProjectHeader from "@/components/layout/ProjectHeader"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { useWorkflowLauncher } from "@/hooks/useWorkflowLauncher"
import { useProjectStore } from "@/store/projectStore"

import type { WorkflowSourceType } from "@/types"
import type { ProjectTab } from "@/types"

// Tabs
import ScenesTab from "./tabs/ScenesTab"
import CharactersTab from "./tabs/CharactersTab"
import EpisodesTab from "./tabs/EpisodesTab"
import ObjectsTab from "./tabs/ObjectsTab"
import PlaceholderTab from "./tabs/PlaceholderTab"
import WorkflowsTab from "./tabs/WorkflowsTab"

// Creators
import SceneCreator from "./SceneCreator"
import EpisodeCreator from "./EpisodeCreator"
import CharacterCreator from "./CharacterCreator"
import ObjectCreator from "./ObjectCreator"
import CharacterBatchUploadDialog from "./CharacterBatchUploadDialog"

const projectTabs: ProjectTab[] = ["episodes", "characters", "scenes", "objects", "workflows"]
const defaultProjectTab: ProjectTab = "scenes"

const secondaryTabs: { id: ProjectTab; label: string }[] = [
  { id: "episodes", label: "片段管理" },
  { id: "characters", label: "角色管理" },
  { id: "scenes", label: "场景管理" },
  { id: "objects", label: "物品管理" },
  { id: "workflows", label: "工作流" },
]

const sortOptions = [
  { id: "recent", label: "最近" },
  { id: "name-asc", label: "名称 A-Z" },
  { id: "name-desc", label: "名称 Z-A" },
] as const

type SortOption = (typeof sortOptions)[number]["id"]

const isProjectTab = (value?: string): value is ProjectTab =>
  Boolean(value && projectTabs.includes(value as ProjectTab))

export default function ProjectDetail() {
  const { id: projectId, tab: tabParam } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { confirm, notify } = useFeedback()
  const launchWorkflow = useWorkflowLauncher()
  const numericProjectId = projectId ? Number(projectId) : null
  // 从 Store 获取状态
  const storeActiveTab = useProjectStore((state) => state.activeTab)
  const currentPage = useProjectStore((state) => state.currentPage)
  const isLoading = useProjectStore((state) => state.isLoading)
  const ui = useProjectStore((state) => state.ui)
  const assets = useProjectStore((state) => state.assets)
  const { 
    setActiveTab, 
    setCurrentPage, 
    closeDrawer, 
    openDrawer,
    loadProjectAssets,
    createEpisode,
    createScene,
    createCharacter,
    createObject,
    bulkDelete,
  } = useProjectStore()
  const [batchMode, setBatchMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [sortBy, setSortBy] = useState<SortOption>("recent")
  const [batchUploadOpen, setBatchUploadOpen] = useState(false)

  const routeTab = isProjectTab(tabParam) ? tabParam : undefined
  const activeTab = routeTab ?? storeActiveTab

  const assetType = useMemo(() => {
    switch (activeTab) {
      case "episodes":
        return "episodes" as const
      case "characters":
        return "characters" as const
      case "scenes":
        return "scenes" as const
      case "objects":
        return "objects" as const
      case "workflows":
        return null
      default:
        return "scenes" as const
    }
  }, [activeTab])

  useEffect(() => {
    setBatchMode(false)
    setSelectedIds([])
  }, [activeTab])

  useEffect(() => {
    if (!projectId) return

    const stateTab = location.state?.activeTab
    if (isProjectTab(stateTab) && stateTab !== routeTab) {
      navigate(`/project/${projectId}/${stateTab}`, { replace: true })
      return
    }

    if (!routeTab) {
      navigate(`/project/${projectId}/${defaultProjectTab}`, { replace: true })
    }
  }, [location.state, navigate, projectId, routeTab])

  useEffect(() => {
    if (storeActiveTab !== activeTab) {
      setActiveTab(activeTab)
    }
  }, [activeTab, setActiveTab, storeActiveTab])

  useEffect(() => {
    if (!numericProjectId) return

    void loadProjectAssets(numericProjectId, true)
  }, [loadProjectAssets, numericProjectId])

  const handleTabChange = (tab: ProjectTab) => {
    if (!projectId || tab === activeTab) return
    navigate(`/project/${projectId}/${tab}`)
  }

  const sortItemsByName = <T extends { name: string }>(items: T[], direction: "asc" | "desc") => {
    const multiplier = direction === "asc" ? 1 : -1
    return [...items].sort((left, right) => multiplier * left.name.localeCompare(right.name, "zh-CN"))
  }

  const sortedAssets = useMemo(() => {
    switch (sortBy) {
      case "name-asc":
        return {
          episodes: sortItemsByName(assets.episodes, "asc"),
          scenes: sortItemsByName(assets.scenes, "asc"),
          characters: sortItemsByName(assets.characters, "asc"),
          objects: sortItemsByName(assets.objects, "asc"),
        }
      case "name-desc":
        return {
          episodes: sortItemsByName(assets.episodes, "desc"),
          scenes: sortItemsByName(assets.scenes, "desc"),
          characters: sortItemsByName(assets.characters, "desc"),
          objects: sortItemsByName(assets.objects, "desc"),
        }
      case "recent":
      default:
        return {
          episodes: assets.episodes,
          scenes: assets.scenes,
          characters: assets.characters,
          objects: assets.objects,
        }
    }
  }, [assets.characters, assets.episodes, assets.objects, assets.scenes, sortBy])

  const handleToggleSelect = (id: number) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    )
  }

  const handleBatchDelete = async () => {
    if (!assetType) {
      notify.info("工作流暂不支持批量删除")
      return
    }
    
    if (!batchMode) {
      setBatchMode(true)
      return
    }

    if (selectedIds.length === 0) {
      notify.info("请先选择要删除的内容")
      return
    }

    const confirmed = await confirm({
      title: `删除所选${selectedIds.length}项`,
      description: `当前页共 ${assets[assetType].length} 项，删除后无法恢复。确定继续吗？`,
      confirmText: "确认删除",
      tone: "danger",
    })

    if (!confirmed) return

    if (!numericProjectId) return

    await bulkDelete(numericProjectId, assetType, selectedIds)
    notify.success(`已删除 ${selectedIds.length} 项`)
    setSelectedIds([])
    setBatchMode(false)
  }

  const handleOpenInfiniteCanvas = (sourceType: WorkflowSourceType, sourceName?: string, sourceAssetId?: number) => {
    if (!projectId) return

    launchWorkflow({
      projectId,
      sourceType,
      sourceName,
      sourceAssetId,
    })
  }

  // Tab 内容渲染
  const renderTabContent = () => {
    switch (activeTab) {
      case "episodes":
        return (
          <EpisodesTab
            episodes={sortedAssets.episodes}
            onAddNew={() => openDrawer('episode')}
            projectId={numericProjectId}
            batchMode={batchMode}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
          />
        )
      case "scenes":
        return (
          <ScenesTab
            scenes={sortedAssets.scenes}
            onAddNew={() => openDrawer('scene')}
            onOpenCanvas={() => handleOpenInfiniteCanvas("scene")}
            projectId={numericProjectId}
            batchMode={batchMode}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
          />
        )
      case "characters":
        return (
          <CharactersTab
            characters={sortedAssets.characters}
            onAddNew={() => openDrawer('character')}
            onOpenCanvas={() => handleOpenInfiniteCanvas("character")}
            projectId={numericProjectId}
            batchMode={batchMode}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
          />
        )
      case "objects":
        return (
          <ObjectsTab
            objects={sortedAssets.objects}
            onAddNew={() => openDrawer('object')}
            onOpenCanvas={() => handleOpenInfiniteCanvas("object")}
            batchMode={batchMode}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
          />
        )
      case "workflows":
        return <WorkflowsTab />
      default:
        return <PlaceholderTab label={secondaryTabs.find(t => t.id === activeTab)?.label || ""} />
    }
  }

  return (
    <div className="workspace-shell h-screen overflow-hidden bg-[hsl(var(--surface))]">
      {/* Episode Creator Dialog */}
      <EpisodeCreator 
        open={ui.isEpisodeDrawerOpen} 
        onOpenChange={(open) => open ? openDrawer('episode') : closeDrawer('episode')} 
        onCreate={(data) => {
          if (!numericProjectId) return
          void createEpisode(numericProjectId, data)
        }} 
      />

      {/* Character Creator Drawer */}
      <CharacterCreator 
        open={ui.isCharacterDrawerOpen} 
        onOpenChange={(open) => open ? openDrawer('character') : closeDrawer('character')} 
        onCreate={(data) => {
          if (!numericProjectId) return
          void createCharacter(numericProjectId, data)
        }} 
      />

      {/* Scene Creator Drawer */}
      <SceneCreator 
        open={ui.isSceneDrawerOpen} 
        onOpenChange={(open) => open ? openDrawer('scene') : closeDrawer('scene')} 
        onCreate={(data) => {
          if (!numericProjectId) return
          void createScene(numericProjectId, data)
        }} 
      />

      {/* Character Batch Upload Dialog */}
      <CharacterBatchUploadDialog
        open={batchUploadOpen}
        onOpenChange={setBatchUploadOpen}
        projectId={numericProjectId || 0}
        onCreate={async (data) => {
          if (!numericProjectId) return
          await createCharacter(numericProjectId, data)
        }}
      />

      {/* Object Creator Drawer */}
      <ObjectCreator 
        open={ui.isObjectDrawerOpen} 
        onOpenChange={(open) => open ? openDrawer('object') : closeDrawer('object')} 
        onCreate={(data) => {
          if (!numericProjectId) return
          void createObject(numericProjectId, data)
        }} 
      />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="relative ml-64 flex h-screen flex-col overflow-hidden">
        {/* Header */}
        <ProjectHeader
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />

        {/* Content Canvas */}
        <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          <div className="flex min-h-full flex-col px-8 pb-12 pt-24">
            {/* Secondary Toolbar */}
            <div className="mb-8 flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[hsl(var(--secondary))]">排序:</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center rounded-lg bg-[hsl(var(--surface-container-low))] px-3 py-2 text-xs font-medium text-[hsl(var(--secondary))] transition-colors hover:bg-[hsl(var(--surface-container-high))] hover:text-[hsl(var(--on-surface))]"
                    >
                      <span>{sortOptions.find((option) => option.id === sortBy)?.label ?? "最近"}</span>
                      <ChevronDown className="ml-2 h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-36">
                    {sortOptions.map((option) => (
                      <DropdownMenuItem key={option.id} onClick={() => setSortBy(option.id)}>
                        {option.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {batchMode && (
                  <span className="rounded-full bg-[hsl(var(--surface-container-low))] px-3 py-2 text-xs font-medium text-[hsl(var(--primary))]">
                    已选 {selectedIds.length} 项
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {batchMode && assetType && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setBatchMode(false)
                      setSelectedIds([])
                    }}
                    className="rounded-xl px-4 py-2.5 text-xs font-bold text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-low))]"
                  >
                    取消
                  </Button>
                )}
                {activeTab === "characters" && (
                  <Button
                    onClick={() => setBatchUploadOpen(true)}
                    variant="outline"
                    className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold hover:bg-[hsl(var(--surface-container-low))]"
                  >
                    <Upload className="w-4 h-4" />
                    上传角色
                  </Button>
                )}
                {assetType && (
                  <Button
                    onClick={handleBatchDelete}
                    className="flex items-center gap-2 rounded-xl border-0 bg-[hsl(var(--primary))] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-90"
                  >
                    <Trash2 className="w-4 h-4" />
                    {batchMode ? `删除所选${selectedIds.length ? ` (${selectedIds.length})` : ""}` : "批量删除"}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-1 flex-col">
              {isLoading ? (
                <div className="mb-4 rounded-xl bg-[hsl(var(--surface-container-low))] px-4 py-3 text-sm text-[hsl(var(--secondary))]">
                  正在加载项目资产...
                </div>
              ) : null}
              {/* Tab Content */}
              <div className="flex-1">
                {renderTabContent()}
              </div>

              {/* Pagination */}
              <div className="mt-16 flex justify-center">
                <div className="flex items-center gap-1 rounded-xl bg-[hsl(var(--surface-container-low))] p-1.5">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="w-8 h-8 rounded-lg"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {[1, 2, 3].map((page) => (
                    <Button
                      key={page}
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-xs ${currentPage === page ? "bg-[hsl(var(--primary))] text-white" : ""}`}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="w-8 h-8 rounded-lg"
                    onClick={() => setCurrentPage(Math.min(3, currentPage + 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <footer className="mt-auto border-t border-[hsl(var(--outline-variant))]/15 py-8">
              <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
                <div>
                  <span className="text-sm font-bold text-[hsl(var(--on-surface))]">MangaCanvas</span>
                  <p className="mt-1 text-xs text-[hsl(var(--on-secondary-fixed-variant))]">© 2024 Kinetic Gallery. 保留所有权利。</p>
                </div>
                <div className="flex gap-6">
                  <Link to="/privacy" className="text-xs text-[hsl(var(--secondary))] transition-colors hover:text-[hsl(var(--primary))]">
                    隐私政策
                  </Link>
                  <Link to="/terms" className="text-xs text-[hsl(var(--secondary))] transition-colors hover:text-[hsl(var(--primary))]">
                    服务条款
                  </Link>
                  <Link to="/contact" className="text-xs text-[hsl(var(--secondary))] transition-colors hover:text-[hsl(var(--primary))]">
                    联系我们
                  </Link>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </main>
    </div>
  )
}
