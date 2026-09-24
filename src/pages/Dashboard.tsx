import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Plus, 
  History,
  FolderOpen,
  Sparkles,
  LayoutGrid,
  Box,
  Users,
  ArrowRight,
  Play,
  Image,
  Video,
  Wand2,
  Star,
} from "lucide-react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useEffect, useState } from "react"
import ProjectCreator from "./ProjectCreator"
import WorkspaceHeader from "@/components/layout/WorkspaceHeader"
import WorkspaceLayout from "@/components/layout/WorkspaceLayout"
import { projectsApi } from "@/api"
import { getCurrentUser, setActiveProjectId } from "@/lib/session"
import { mapProjectCard, mapProjectStats } from "@/lib/projectMappers"
import { refreshProjects, useProjectsStore } from "@/store/projectsStore"
import { useWorkflowLauncher } from "@/hooks/useWorkflowLauncher"
import { workflowsApi } from "@/features/project/api/workflows"
import { projectAssetsPath, projectDashboardPath, projectScriptPath, workflowCanvasNavState } from "@/lib/workspaceRoutes"
import { QuerySpinner } from "@/components/feedback/ListQueryState"
import { useFeedback } from "@/components/feedback/FeedbackProvider"

const activities = [
  {
    id: 1,
    type: "upload",
    users: [
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop"
    ],
    text: "Elena 和 Marcus",
    action: "上传了 12 个新场景",
    time: "12:45"
  },
  {
    id: 2,
    type: "review",
    text: "编辑审核",
    action: "完成了第 04 章的审核",
    time: "昨天"
  },
  {
    id: 3,
    type: "upload",
    users: ["https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop"],
    text: "陈晓明",
    action: "创建了新角色",
    time: "2 小时前"
  }
]

// 空状态组件
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-24 h-24 rounded-full bg-[hsl(var(--surface-container-high))] flex items-center justify-center mb-6">
        <FolderOpen className="w-12 h-12 text-[hsl(var(--secondary))]" />
      </div>
      <h2 className="text-2xl font-black text-[hsl(var(--on-surface))] mb-3">
        还没有项目
      </h2>
      <p className="text-[hsl(var(--secondary))] max-w-md mb-8 leading-relaxed">
        你可以新建项目开始创作，或等待管理员将自己拉进某个项目。
      </p>
      <Button
        onClick={onCreate}
        className="signature-gradient rounded-xl border-0 px-8 py-4 text-base font-bold text-white shadow-lg hover:opacity-90 hover:scale-105 transition-all"
      >
        <Plus className="mr-2 h-5 w-5" />
        新建项目
      </Button>
      
      <div className="mt-12 grid grid-cols-3 gap-6 max-w-2xl">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6 text-[hsl(var(--primary))]" />
          </div>
          <p className="text-xs font-bold text-[hsl(var(--on-surface))]">AI 辅助创作</p>
          <p className="text-[10px] text-[hsl(var(--secondary))] mt-1">智能生成场景和角色</p>
        </div>
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center mx-auto mb-3">
            <FolderOpen className="w-6 h-6 text-[hsl(var(--primary))]" />
          </div>
          <p className="text-xs font-bold text-[hsl(var(--on-surface))]">资产管理</p>
          <p className="text-[10px] text-[hsl(var(--secondary))] mt-1">统一管理所有资源</p>
        </div>
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center mx-auto mb-3">
            <LayoutGrid className="w-6 h-6 text-[hsl(var(--primary))]" />
          </div>
          <p className="text-xs font-bold text-[hsl(var(--on-surface))]">工作流编排</p>
          <p className="text-[10px] text-[hsl(var(--secondary))] mt-1">可视化编辑流程</p>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { notify } = useFeedback()
  const { id: projectId } = useParams<{ id: string }>()
  const [createdProjects, setCreatedProjects] = useState<Array<{ id: number; name: string; image: string; status: string; updated: string }>>([])
  const [projectStats, setProjectStats] = useState({ episodeCount: 0, sceneCount: 0, characterCount: 0, objectCount: 0 })
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false)
  const { projects: allProjects, isLoaded: projectsLoaded, fetchProjects } = useProjectsStore()
  const launchWorkflow = useWorkflowLauncher()

  const projects = (() => {
    const mapped = allProjects.map((project) => ({
      id: project.id,
      name: project.name,
      image: project.coverImage || '/default-project.png',
      status: project.status as "in-progress" | "completed" | "draft",
      updated: project.updatedAt || project.createdAt || '',
    }))
    const extras = createdProjects.filter((item) => !mapped.some((project) => project.id === item.id))
    return [...extras, ...mapped]
  })()

  const currentProject = projects.find(p => p.id === Number(projectId)) || projects[0]
  const hasProjects = projects.length > 0
  const awaitingProjects = !projectsLoaded && !hasProjects && !projectId
  const showProjectEmpty = !awaitingProjects && !hasProjects && !projectId
  
  useEffect(() => {
    // 如果全局未加载，触发加载
    if (!projectsLoaded) {
      void fetchProjects()
    }
  }, [projectsLoaded, fetchProjects])

  useEffect(() => {
    if (!currentProject?.id) return
    setActiveProjectId(currentProject.id)
    void projectsApi.getById(currentProject.id).then((detail) => setProjectStats(mapProjectStats(detail))).catch(() => undefined)
  }, [currentProject?.id])

  const handleCreateProject = async (data: {
    name: string
    password?: string
    mode: string
    description: string
    scriptFile?: File | null
  }) => {
    const organizationId = getCurrentUser()?.organizationIds?.[0]
    if (!organizationId) {
      notify.error("当前账号缺少组织信息，无法创建项目")
      return
    }

    try {
      const project = await projectsApi.create({
        organizationId,
        name: data.name,
        description: data.description,
        coverImage: null,
        isPublic: false,
      })
      const mapped = mapProjectCard(project)
      setCreatedProjects((prev) => [{ id: mapped.id, name: mapped.name, image: mapped.image, status: mapped.status, updated: mapped.modified }, ...prev])
      setActiveProjectId(project.id)
      await refreshProjects()
      setIsProjectDialogOpen(false)
      navigate(projectDashboardPath(project.id))
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "创建项目失败")
    }
  }

  const handleEnterCanvas = async () => {
    const pid = currentProject?.id || Number(projectId)
    if (!pid) return
    const returnTo = projectDashboardPath(pid)
    const list = await workflowsApi.getAll(pid, { page: 1, size: 1 })
    if (list.success && list.data.list[0]) {
      navigate(`/project/${pid}/workflows/${list.data.list[0].id}`, {
        state: workflowCanvasNavState(returnTo, "dashboard"),
      })
      return
    }
    await launchWorkflow({
      projectId: String(pid),
      sourceType: "blank",
      successMessage: "已创建空白工作流",
      returnTo,
      from: "dashboard",
    })
  }

  return (
    <>
      <ProjectCreator
        open={isProjectDialogOpen}
        onOpenChange={setIsProjectDialogOpen}
        onCreate={handleCreateProject}
      />
      <WorkspaceLayout
        header={
          <WorkspaceHeader
            title={hasProjects || projectId ? '工作台' : '欢迎'}
            subtitle={hasProjects || projectId ? undefined : "开始你的创作之旅"}
            searchPlaceholder="搜索..."
            actions={
              hasProjects || projectId ? (
                <Button
                  onClick={() => navigate(projectAssetsPath(currentProject?.id || projectId || ""))}
                  className="signature-gradient rounded-xl border-0 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90"
                >
                  进入资产管理
                </Button>
              ) : (
                <Button
                  onClick={() => setIsProjectDialogOpen(true)}
                  className="signature-gradient rounded-xl border-0 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  新建项目
                </Button>
              )
            }
          />
        }
      >
        {awaitingProjects ? (
          <QuerySpinner label="正在同步项目数据..." />
        ) : showProjectEmpty ? (
          <EmptyState onCreate={() => setIsProjectDialogOpen(true)} />
        ) : (
        <>
        {/* 无限画布入口 - 核心区域 */}
        <section className="mb-7">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[hsl(var(--on-surface))] flex items-center gap-2">
              无限画布
              <span className="w-2 h-2 rounded-full bg-[hsl(var(--primary))] animate-pulse"></span>
            </h3>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleEnterCanvas}
              className="text-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10"
            >
              进入画布
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          
          <Card 
            onClick={handleEnterCanvas}
            className="group relative overflow-hidden border-0 bg-gradient-to-br from-[hsl(var(--primary))]/10 via-[hsl(var(--surface-container-low))] to-[hsl(var(--surface-container-high))] p-6 cursor-pointer transition-all duration-500 hover:shadow-xl hover:shadow-[hsl(var(--primary))]/10 hover:scale-[1.01]"
          >
            {/* 背景装饰 */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
              <div className="absolute top-0 right-0 w-96 h-96 bg-[hsl(var(--primary))]/5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-[hsl(var(--primary))]/5 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2"></div>
            </div>
            
            <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              {/* 左侧内容 */}
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] text-xs font-bold mb-4">
                  <Sparkles className="w-3 h-3" />
                  AI 驱动创作
                </div>
                <h2 className="text-xl lg:text-2xl font-black text-[hsl(var(--on-surface))] mb-3 cn-keep">
                  开始你的创作之旅
                </h2>
                <p className="text-[hsl(var(--secondary))] max-w-lg mb-6">
                  在无限画布中自由编排场景、角色和工作流。支持文生图、图生图、图生视频等多种 AI 创作模式。
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button 
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEnterCanvas()
                    }}
                    className="signature-gradient rounded-xl border-0 px-6 py-3 text-sm font-bold text-white shadow-lg hover:opacity-90 hover:scale-105 transition-all"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    立即开始
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(projectScriptPath(currentProject?.id || projectId || ""))
                    }}
                    className="rounded-xl border-[hsl(var(--outline-variant))] px-6 py-3 text-sm font-bold hover:bg-[hsl(var(--surface-container-high))]"
                  >
                    剧本创作
                  </Button>
                </div>
              </div>
              
              {/* 右侧功能卡片 */}
              <div className="flex gap-3 lg:gap-4">
                <div className="flex flex-col gap-3 lg:gap-4">
                  <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-2xl bg-[hsl(var(--surface-container-lowest))] flex flex-col items-center justify-center gap-2 shadow-sm group-hover:shadow-md transition-all group-hover:-translate-y-1">
                    <Wand2 className="w-6 h-6 lg:w-8 lg:h-8 text-[hsl(var(--primary))]" />
                    <span className="text-[10px] font-bold text-[hsl(var(--on-surface))]">文生图</span>
                  </div>
                  <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-2xl bg-[hsl(var(--surface-container-lowest))] flex flex-col items-center justify-center gap-2 shadow-sm group-hover:shadow-md transition-all group-hover:translate-y-1">
                    <Image className="w-6 h-6 lg:w-8 lg:h-8 text-[hsl(var(--primary))]" />
                    <span className="text-[10px] font-bold text-[hsl(var(--on-surface))]">图生图</span>
                  </div>
                </div>
                <div className="flex flex-col gap-3 lg:gap-4 mt-4">
                  <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-2xl bg-[hsl(var(--surface-container-lowest))] flex flex-col items-center justify-center gap-2 shadow-sm group-hover:shadow-md transition-all group-hover:-translate-y-1">
                    <Video className="w-6 h-6 lg:w-8 lg:h-8 text-[hsl(var(--primary))]" />
                    <span className="text-[10px] font-bold text-[hsl(var(--on-surface))]">图生视频</span>
                  </div>
                  <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-2xl bg-[hsl(var(--primary))] flex flex-col items-center justify-center gap-2 shadow-lg shadow-[hsl(var(--primary))]/30 group-hover:shadow-xl transition-all group-hover:translate-y-1">
                    <LayoutGrid className="w-6 h-6 lg:w-8 lg:h-8 text-white" />
                    <span className="text-[10px] font-bold text-white">自由编排</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* 项目统计 */}
        <section className="mb-7">
          <h3 className="text-base font-bold text-[hsl(var(--on-surface))] mb-4">项目概览</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="border-0 bg-[hsl(var(--surface-container-lowest))] p-4 shadow-none hover:bg-[hsl(var(--surface-container-high))] transition-colors cursor-pointer group" onClick={() => navigate(projectAssetsPath(projectId || "", "episodes"))}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] font-bold text-[hsl(var(--secondary))]">剧集</p>
                <Box className="w-4 h-4 text-[hsl(var(--secondary))] group-hover:text-[hsl(var(--primary))] transition-colors" />
              </div>
              <p className="text-3xl font-black text-[hsl(var(--on-surface))]">{projectStats.episodeCount}</p>
              <p className="mt-1 text-[13px] text-[hsl(var(--secondary))]">管理故事章节</p>
            </Card>
            <Card className="border-0 bg-[hsl(var(--surface-container-lowest))] p-4 shadow-none hover:bg-[hsl(var(--surface-container-high))] transition-colors cursor-pointer group" onClick={() => navigate(projectAssetsPath(projectId || "", "scenes"))}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] font-bold text-[hsl(var(--secondary))]">场景</p>
                <Image className="w-4 h-4 text-[hsl(var(--secondary))] group-hover:text-[hsl(var(--primary))] transition-colors" />
              </div>
              <p className="text-3xl font-black text-[hsl(var(--on-surface))]">{projectStats.sceneCount}</p>
              <p className="mt-1 text-[13px] text-[hsl(var(--secondary))]">已创建的场景</p>
            </Card>
            <Card className="border-0 bg-[hsl(var(--surface-container-lowest))] p-4 shadow-none hover:bg-[hsl(var(--surface-container-high))] transition-colors cursor-pointer group" onClick={() => navigate(projectAssetsPath(projectId || "", "characters"))}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] font-bold text-[hsl(var(--secondary))]">角色</p>
                <Users className="w-4 h-4 text-[hsl(var(--secondary))] group-hover:text-[hsl(var(--primary))] transition-colors" />
              </div>
              <p className="text-3xl font-black text-[hsl(var(--on-surface))]">{projectStats.characterCount}</p>
              <p className="mt-1 text-[13px] text-[hsl(var(--secondary))]">项目角色数</p>
            </Card>
            <Card className="border-0 bg-[hsl(var(--surface-container-lowest))] p-4 shadow-none hover:bg-[hsl(var(--surface-container-high))] transition-colors cursor-pointer group" onClick={() => navigate(projectAssetsPath(projectId || "", "objects"))}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] font-bold text-[hsl(var(--secondary))]">物品</p>
                <Sparkles className="w-4 h-4 text-[hsl(var(--secondary))] group-hover:text-[hsl(var(--primary))] transition-colors" />
              </div>
              <p className="text-3xl font-black text-[hsl(var(--on-surface))]">{projectStats.objectCount}</p>
              <p className="mt-1 text-[13px] text-[hsl(var(--secondary))]">道具和素材</p>
            </Card>
          </div>
        </section>

        {/* 快捷入口网格 */}
        <section className="mb-7">
          <h3 className="text-base font-bold text-[hsl(var(--on-surface))] mb-4">快速入口</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <Card 
              onClick={() => navigate(projectAssetsPath(projectId || "", "episodes"))}
              className="group bg-[hsl(var(--surface-container-lowest))] rounded-xl p-4 transition-all duration-300 hover:bg-[hsl(var(--surface-container-highest))] border-0 shadow-none cursor-pointer hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Box className="w-5 h-5 text-[hsl(var(--primary))]" />
              </div>
              <h4 className="text-sm font-bold text-[hsl(var(--on-surface))] mb-1">剧集管理</h4>
              <p className="text-[13px] text-[hsl(var(--secondary))]">故事章节管理</p>
            </Card>
            <Card 
              onClick={() => navigate(projectAssetsPath(projectId || "", "scenes"))}
              className="group bg-[hsl(var(--surface-container-lowest))] rounded-xl p-4 transition-all duration-300 hover:bg-[hsl(var(--surface-container-highest))] border-0 shadow-none cursor-pointer hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Image className="w-5 h-5 text-[hsl(var(--primary))]" />
              </div>
              <h4 className="text-sm font-bold text-[hsl(var(--on-surface))] mb-1">场景管理</h4>
              <p className="text-[13px] text-[hsl(var(--secondary))]">背景和场景资源</p>
            </Card>
            <Card 
              onClick={() => navigate(projectAssetsPath(projectId || "", "characters"))}
              className="group bg-[hsl(var(--surface-container-lowest))] rounded-xl p-4 transition-all duration-300 hover:bg-[hsl(var(--surface-container-highest))] border-0 shadow-none cursor-pointer hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5 text-[hsl(var(--primary))]" />
              </div>
              <h4 className="text-sm font-bold text-[hsl(var(--on-surface))] mb-1">角色管理</h4>
              <p className="text-[13px] text-[hsl(var(--secondary))]">角色设定</p>
            </Card>
            <Card 
              onClick={handleEnterCanvas}
              className="group bg-[hsl(var(--primary))]/5 rounded-xl p-4 transition-all duration-300 hover:bg-[hsl(var(--primary))]/10 border-0 shadow-none cursor-pointer hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary))] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <LayoutGrid className="w-5 h-5 text-white" />
              </div>
              <h4 className="text-sm font-bold text-[hsl(var(--on-surface))] mb-1">工作流编排</h4>
              <p className="text-[13px] text-[hsl(var(--secondary))]">无限画布创作</p>
            </Card>
            <Card
              onClick={() => navigate(projectAssetsPath(projectId || "", "favorites"))}
              className="group bg-[hsl(var(--surface-container-lowest))] rounded-xl p-4 transition-all duration-300 hover:bg-[hsl(var(--surface-container-highest))] border-0 shadow-none cursor-pointer hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Star className="w-5 h-5 text-[hsl(var(--primary))]" />
              </div>
              <h4 className="text-sm font-bold text-[hsl(var(--on-surface))] mb-1">我的收藏</h4>
              <p className="text-[13px] text-[hsl(var(--secondary))]">回看星标生成结果</p>
            </Card>
          </div>
        </section>

        {/* 活动动态 */}
        <section className="mb-7">
          <h3 className="text-base font-bold text-[hsl(var(--on-surface))] mb-4">最近活动</h3>
          <div className="space-y-2">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-center gap-4 px-3 py-2.5 rounded-xl bg-[hsl(var(--surface-container-low))]/50 hover:bg-[hsl(var(--surface-container-low))] transition-colors">
                {activity.type === "upload" ? (
                  <div className="flex -space-x-2">
                    {activity.users?.map((user, idx) => (
                      <Avatar key={idx} className="w-8 h-8 border-2 border-[hsl(var(--surface))]">
                        <AvatarImage src={user} alt="用户" />
                        <AvatarFallback className="text-xs">U{idx + 1}</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[hsl(var(--primary))]/10 flex items-center justify-center text-[hsl(var(--primary))]">
                    <History className="w-4 h-4" />
                  </div>
                )}
                <div className="text-sm flex-1">
                  <span className="font-bold text-[hsl(var(--on-surface))]">{activity.text}</span>
                  <span className="text-[hsl(var(--secondary))]"> {activity.action} </span>
                </div>
                <div className="text-xs text-[hsl(var(--secondary))] font-medium">
                  {activity.time}
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-16 border-t border-[hsl(var(--outline-variant))]/15 py-10">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div>
              <span className="text-lg font-bold text-[hsl(var(--on-surface))]">MangaCanvas</span>
              <p className="mt-1 text-xs text-[hsl(var(--on-secondary-fixed-variant))]">© 2024 MangaCanvas. 保留所有权利。</p>
            </div>
            <div className="flex gap-8">
              <Link to="/privacy" className="text-xs text-[hsl(var(--secondary))] transition-opacity hover:text-[hsl(var(--primary))]">
                隐私政策
              </Link>
              <Link to="/terms" className="text-xs text-[hsl(var(--secondary))] transition-opacity hover:text-[hsl(var(--primary))]">
                服务条款
              </Link>
              <Link to="/contact" className="text-xs text-[hsl(var(--secondary))] transition-opacity hover:text-[hsl(var(--primary))]">
                联系我们
              </Link>
            </div>
          </div>
        </footer>
        </>
        )}
      </WorkspaceLayout>
    </>
  )
}
