import { useEffect, useState, useRef, Suspense, lazy } from "react"
import { HashRouter, Routes, Route, Link, useLocation, useNavigate, Navigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { 
  Package, 
  Clapperboard, 
  Users, 
  Sparkles, 
  ArrowRight, 
  Wand2,
  Loader2
} from "lucide-react"

// 核心页面直接加载
import Dashboard from "./pages/Dashboard"
import Login from "./pages/auth/Login"
import EpisodeDetail from "./pages/project/EpisodeDetail"

// 非核心页面懒加载
const ProjectsList = lazy(() => import("./pages/ProjectsList"))
const ProjectPermissions = lazy(() => import("./pages/ProjectPermissions"))
const Members = lazy(() => import("./pages/Members"))
const ProjectDetail = lazy(() => import("./pages/project"))
const WorkflowCanvas = lazy(() => import("./pages/project/WorkflowCanvas"))
const Pricing = lazy(() => import("./pages/Pricing"))
const Gallery = lazy(() => import("./pages/Gallery"))
const Terms = lazy(() => import("./pages/Terms"))
const Privacy = lazy(() => import("./pages/Privacy"))
const Contact = lazy(() => import("./pages/Contact"))
const Workflow = lazy(() => import("./pages/Workflow"))
const Assets = lazy(() => import("./pages/Assets"))
import {
  IDENTITY_CHANGE_EVENT,
  canAccessProjectRoutes,
  getStoredIdentity,
  getAuthToken,
  type IdentityOption,
} from "@/lib/session"

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const token = getAuthToken()
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return <>{children}</>
}

function IdentityRouteGuard() {
  const location = useLocation()
  const navigate = useNavigate()
  const [currentIdentity, setCurrentIdentity] = useState<IdentityOption>(getStoredIdentity)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const prevIdentityRef = useRef<IdentityOption>(getStoredIdentity())

  useEffect(() => {
    const syncIdentity = () => setCurrentIdentity(getStoredIdentity())
    const handleIdentityChange = (event: Event) => {
      const nextIdentity = (event as CustomEvent<IdentityOption>).detail
      if (nextIdentity && nextIdentity !== prevIdentityRef.current) {
        setCurrentIdentity(nextIdentity)
      }
    }

    window.addEventListener(IDENTITY_CHANGE_EVENT, handleIdentityChange as EventListener)
    window.addEventListener("storage", syncIdentity)

    return () => {
      window.removeEventListener(IDENTITY_CHANGE_EVENT, handleIdentityChange as EventListener)
      window.removeEventListener("storage", syncIdentity)
    }
  }, [])

  useEffect(() => {
    const isProjectScopedRoute =
      location.pathname === "/dashboard" || location.pathname.startsWith("/project/")

    // 只在身份发生变化时处理
    if (prevIdentityRef.current === currentIdentity) {
      return
    }

    // 在项目路由内切换身份：显示 loading 并刷新页面（模拟重新登录效果）
    if (isProjectScopedRoute) {
      // 显示过渡动画
      setIsTransitioning(true)
      
      // 延迟后跳转：有权限的跳转到看板，无权限的跳转到项目列表
      const timer = setTimeout(() => {
        if (canAccessProjectRoutes(currentIdentity)) {
          // 有项目访问权限：跳转到看板
          navigate("/dashboard", { replace: true })
        } else {
          // 无项目访问权限：跳转到项目列表
          navigate("/projects", {
            replace: true,
            state: {
              redirectedByIdentity: currentIdentity,
              from: location.pathname,
            },
          })
        }
        setIsTransitioning(false)
        prevIdentityRef.current = currentIdentity
      }, 1500)
      
      return () => clearTimeout(timer)
    } else {
      // 非项目路由：直接更新身份，不显示 loading
      prevIdentityRef.current = currentIdentity
    }
  }, [currentIdentity, location.pathname, navigate])

  // 身份切换 Loading 遮罩 - 与切换项目一致的强打断效果
  if (isTransitioning) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[hsl(var(--surface))]/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-[hsl(var(--primary))]" />
          <p className="text-sm font-medium text-[hsl(var(--on-surface))]">
            正在切换身份...
          </p>
        </div>
      </div>
    )
  }

  return null
}

function Home() {
  return (
    <div className="min-h-screen bg-[hsl(var(--surface))]">
      {/* Top Navigation */}
      <nav className="fixed top-0 w-full z-50 glass-effect bg-[hsl(var(--surface))]/80 shadow-[0_40px_40px_rgba(27,28,28,0.04)]">
        <div className="flex justify-between items-center px-8 h-20 w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-12">
            <span className="text-2xl font-black text-[hsl(var(--on-surface))] tracking-tighter">
              MangaCanvas
            </span>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium">
              <Link to="/gallery" className="text-[hsl(var(--on-secondary-fixed-variant))] hover:text-[hsl(var(--primary))] transition-colors duration-300">
                画廊
              </Link>
              <Link to="/workflow" className="text-[hsl(var(--on-secondary-fixed-variant))] hover:text-[hsl(var(--primary))] transition-colors duration-300">
                工作流
              </Link>
              <Link to="/pricing" className="text-[hsl(var(--on-secondary-fixed-variant))] hover:text-[hsl(var(--primary))] transition-colors duration-300">
                价格
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost" className="hidden md:block text-[hsl(var(--on-secondary-fixed-variant))] hover:text-[hsl(var(--primary))]">
                登录
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button className="signature-gradient text-white px-6 py-2.5 rounded-xl text-sm font-semibold scale-95 active:scale-90 transition-transform border-0">
                创建项目
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-20">
        {/* Hero Section */}
        <section className="relative min-h-[921px] flex items-center px-8 py-20 overflow-hidden">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            {/* Left Content */}
            <div className="lg:col-span-6 z-10">
              <span className="text-[hsl(var(--primary))] font-bold tracking-[0.2em] uppercase text-xs mb-6 block">
                叙事新纪元
              </span>
              <h1 className="text-5xl md:text-7xl font-black text-[hsl(var(--on-surface))] leading-[1.1] tracking-tighter mb-8">
                将漫画转化为 <span className="text-[hsl(var(--secondary))] italic">电影级</span> 体验
              </h1>
              <p className="text-lg text-[hsl(var(--on-secondary-fixed-variant))] max-w-lg mb-10 leading-relaxed">
                为创作者打造的终极资产管理和序列编排工具。通过高端编辑工作流，将静态画面转化为动态叙事。
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/dashboard">
                  <Button className="signature-gradient text-white px-8 py-6 rounded-xl font-bold text-lg hover:shadow-lg transition-all scale-100 active:scale-95 border-0">
                    开始使用
                  </Button>
                </Link>
                <Button variant="secondary" className="bg-[hsl(var(--surface-container-high))] text-[hsl(var(--on-surface))] px-8 py-6 rounded-xl font-bold text-lg hover:bg-[hsl(var(--surface-container-highest))] transition-all">
                  观看演示
                </Button>
              </div>
            </div>

            {/* Right Image */}
            <div className="lg:col-span-6 relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl rotate-2 hover:rotate-0 transition-transform duration-700">
                <img 
                  src="https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&h=1067&fit=crop" 
                  alt="漫画动作场景" 
                  className="w-full aspect-[3/4] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--on-surface))]/40 to-transparent" />
              </div>
              
              {/* Overlapping Card */}
              <Card className="absolute -bottom-10 -left-10 bg-[hsl(var(--surface-container-lowest))] p-6 rounded-xl shadow-xl max-w-[240px] hidden md:block border-0">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[hsl(var(--primary-fixed))] flex items-center justify-center">
                    <Wand2 className="w-5 h-5 text-[hsl(var(--primary))]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--on-surface-variant))]">实时同步</p>
                    <p className="text-[10px] text-[hsl(var(--secondary))]">编辑阶段</p>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-[hsl(var(--surface-container))] rounded-full overflow-hidden">
                  <div className="h-full bg-[hsl(var(--primary))] w-2/3" />
                </div>
              </Card>
            </div>
          </div>

          {/* Background Grid Pattern */}
          <div className="absolute top-0 right-0 -z-10 w-1/2 h-full opacity-5 pointer-events-none">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <defs>
                <pattern id="grid" height="10" patternUnits="userSpaceOnUse" width="10">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect fill="url(#grid)" height="100" width="100" />
            </svg>
          </div>
        </section>

        {/* Features Bento Grid */}
        <section className="py-32 px-8 bg-[hsl(var(--surface-container-low))]">
          <div className="max-w-7xl mx-auto">
            <div className="mb-20 text-center">
              <h2 className="text-4xl md:text-5xl font-black text-[hsl(var(--on-surface))] tracking-tighter mb-4">
                为卓越而生
              </h2>
              <p className="text-[hsl(var(--secondary))] max-w-xl mx-auto">
                我们的工具架起了传统插画与现代数字制作之间的桥梁。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-auto md:h-[600px]">
              {/* Asset Management - Large Card */}
              <Card className="md:col-span-8 bg-[hsl(var(--surface-container-lowest))] p-10 rounded-xl flex flex-col justify-between group hover:bg-[hsl(var(--surface-container-highest))] transition-all border border-[hsl(var(--outline-variant))]/10 shadow-none">
                <div className="max-w-md">
                  <Package className="w-10 h-10 text-[hsl(var(--primary))] mb-6" fill="currentColor" fillOpacity={0.2} />
                  <h3 className="text-3xl font-bold mb-4 text-[hsl(var(--on-surface))]">资产管理</h3>
                  <p className="text-[hsl(var(--on-secondary-fixed-variant))] leading-relaxed">
                    轻松组织你的画面、纹理和音效。一个将每个资产都视为杰作的集中式素材库。
                  </p>
                </div>
                <div className="mt-12 flex gap-4 overflow-hidden">
                  <div className="w-32 h-40 bg-[hsl(var(--surface-container))] rounded-lg flex-shrink-0 overflow-hidden">
                    <img src="https://images.unsplash.com/photo-1560972550-aba3456b5564?w=200&h=300&fit=crop" alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="w-32 h-40 bg-[hsl(var(--surface-container))] rounded-lg flex-shrink-0 overflow-hidden">
                    <img src="https://images.unsplash.com/photo-1541562232579-512a21360020?w=200&h=300&fit=crop" alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="w-32 h-40 bg-[hsl(var(--surface-container))] rounded-lg flex-shrink-0 overflow-hidden">
                    <img src="https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=200&h=300&fit=crop" alt="" className="w-full h-full object-cover" />
                  </div>
                </div>
              </Card>

              {/* Scene Sequencing */}
              <Card className="md:col-span-4 bg-[hsl(var(--primary))] p-10 rounded-xl flex flex-col justify-between text-white group cursor-pointer border-0 shadow-none">
                <div>
                  <Clapperboard className="w-10 h-10 mb-6" />
                  <h3 className="text-3xl font-bold mb-4">场景编排</h3>
                  <p className="text-white/80 leading-relaxed">
                    从漫画到动态影像的流畅过渡。用节奏精准的蒙太奇构建你的故事板。
                  </p>
                </div>
                <div className="mt-8 flex justify-end">
                  <div className="w-16 h-16 rounded-full border-2 border-white/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ArrowRight className="w-6 h-6" />
                  </div>
                </div>
              </Card>

              {/* Team Collaboration */}
              <Card className="md:col-span-4 bg-[hsl(var(--surface-container-high))] p-10 rounded-xl flex flex-col justify-between hover:bg-[hsl(var(--surface-container-highest))] transition-all border-0 shadow-none">
                <div>
                  <Users className="w-10 h-10 text-[hsl(var(--primary))] mb-6" />
                  <h3 className="text-2xl font-bold mb-4 text-[hsl(var(--on-surface))]">团队协作</h3>
                  <p className="text-[hsl(var(--on-secondary-fixed-variant))] text-sm">
                    实时协作。共享资产、留下反馈、即时迭代。
                  </p>
                </div>
                <div className="mt-6 flex -space-x-3">
                  <Avatar className="w-10 h-10 border-2 border-[hsl(var(--surface))]">
                    <AvatarFallback className="bg-gray-200 text-xs">U1</AvatarFallback>
                  </Avatar>
                  <Avatar className="w-10 h-10 border-2 border-[hsl(var(--surface))]">
                    <AvatarFallback className="bg-gray-300 text-xs">U2</AvatarFallback>
                  </Avatar>
                  <Avatar className="w-10 h-10 border-2 border-[hsl(var(--surface))]">
                    <AvatarFallback className="bg-[hsl(var(--primary))] text-xs font-bold text-white">+5</AvatarFallback>
                  </Avatar>
                </div>
              </Card>

              {/* Advanced Workflow */}
              <Card className="md:col-span-8 bg-[hsl(var(--on-surface))] p-10 rounded-xl flex flex-col md:flex-row items-center gap-8 text-[hsl(var(--surface))] border-0 shadow-none">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-2">高级工作流</h3>
                  <p className="text-[hsl(var(--secondary-fixed-dim))] text-sm">
                    通过 AI 辅助标签和智能画面提取，自动化重复性任务。
                  </p>
                </div>
                <div className="w-full md:w-1/3 aspect-video bg-white/10 rounded-lg backdrop-blur-sm border border-white/10 flex items-center justify-center">
                  <Sparkles className="w-12 h-12 text-[hsl(var(--primary))]" />
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-40 px-8 bg-[hsl(var(--surface))] overflow-hidden relative">
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <h2 className="text-4xl md:text-6xl font-black text-[hsl(var(--on-surface))] tracking-tighter mb-8">
              准备好让你的作品动起来了？
            </h2>
            <p className="text-xl text-[hsl(var(--secondary))] mb-12 max-w-2xl mx-auto">
              加入新一代漫画艺术家和工作室的行列，将静态艺术转化为电影级杰作。
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/dashboard">
                <Button className="signature-gradient text-white px-12 py-6 rounded-xl font-bold text-xl hover:shadow-2xl transition-all scale-100 active:scale-95 border-0">
                  免费开始创作
                </Button>
              </Link>
            </div>
          </div>
          
          {/* Large faint text background */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none select-none">
            <span className="text-[40vw] font-black leading-none text-[hsl(var(--on-surface))]">漫画</span>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[hsl(var(--surface))] w-full pt-8 pb-0 px-8 border-t border-[hsl(var(--outline-variant))]/15">
        <div className="flex flex-col md:flex-row justify-between items-center max-w-7xl mx-auto gap-8">
          <div className="flex flex-col items-center md:items-start gap-4">
            <span className="font-bold text-[hsl(var(--on-surface))] text-xl">MangaCanvas</span>
            <p className="text-xs text-[hsl(var(--on-secondary-fixed-variant))] max-w-xs text-center md:text-left">
              面向全球漫画和连环画创作者的顶级编辑生态系统。
            </p>
          </div>
          <div className="flex gap-8">
            <Link to="/privacy" className="text-xs text-[hsl(var(--secondary))] hover:text-[hsl(var(--primary))] transition-opacity opacity-80 hover:opacity-100">
              隐私政策
            </Link>
            <Link to="/terms" className="text-xs text-[hsl(var(--secondary))] hover:text-[hsl(var(--primary))] transition-opacity opacity-80 hover:opacity-100">
              服务条款
            </Link>
            <Link to="/contact" className="text-xs text-[hsl(var(--secondary))] hover:text-[hsl(var(--primary))] transition-opacity opacity-80 hover:opacity-100">
              联系我们
            </Link>
          </div>
          <p className="text-xs text-[hsl(var(--on-secondary-fixed-variant))]">
            © 2024 Kinetic Gallery. 保留所有权利。
          </p>
        </div>
      </footer>
    </div>
  )
}

// 路由加载占位组件
function RouteLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[hsl(var(--surface))]">
      <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
    </div>
  )
}

function App() {
  return (
    <HashRouter>
      <IdentityRouteGuard />
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/workflow" element={<Workflow />} />

          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/project/:id/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/projects" element={<RequireAuth><ProjectsList /></RequireAuth>} />
          <Route path="/project/:id" element={<RequireAuth><ProjectDetail /></RequireAuth>} />
          <Route path="/project/:id/:tab" element={<RequireAuth><ProjectDetail /></RequireAuth>} />
          <Route path="/project/:projectId/workflows/:workflowId" element={<RequireAuth><WorkflowCanvas /></RequireAuth>} />
          <Route path="/project/:projectId/episode/:episodeId" element={<RequireAuth><EpisodeDetail /></RequireAuth>} />
          <Route path="/project/:projectId/episode/:episodeId/canvas" element={<RequireAuth><WorkflowCanvas /></RequireAuth>} />
          <Route path="/project/:projectId/permissions" element={<RequireAuth><ProjectPermissions /></RequireAuth>} />
          <Route path="/members" element={<RequireAuth><Members /></RequireAuth>} />
          <Route path="/assets" element={<RequireAuth><Assets /></RequireAuth>} />
        </Routes>
      </Suspense>
    </HashRouter>
  )
}

export default App
