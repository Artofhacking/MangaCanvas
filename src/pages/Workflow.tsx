import { Link } from "react-router-dom"
import { ArrowLeft, Sparkles, Image, Users, Wand2, Clapperboard, Rocket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

const steps = [
  {
    icon: Sparkles,
    title: "1. 创意构思",
    description: "在思维画布上自由组织你的想法。使用文本节点记录灵感，图片节点收集参考素材。",
    features: ["无限画布自由布局", "多维度节点连接", "实时协作编辑"],
    color: "bg-amber-500",
  },
  {
    icon: Image,
    title: "2. 资产创建",
    description: "利用 AI 生成或上传你的创作素材。创建角色、场景、道具，建立完整的视觉资产库。",
    features: ["AI 文生图", "角色一致性控制", "风格迁移", "批量生成"],
    color: "bg-blue-500",
  },
  {
    icon: Users,
    title: "3. 角色管理",
    description: "统一管理所有登场角色。设定角色属性、关系，确保全篇视觉一致性。",
    features: ["角色档案", "视觉参考", "出场统计", "关系图谱"],
    color: "bg-purple-500",
  },
  {
    icon: Wand2,
    title: "4. 场景编排",
    description: "将场景和角色组合成分镜。调整构图、景别，预览最终效果。",
    features: ["智能构图", "景别控制", "光影预览", "镜头语言"],
    color: "bg-emerald-500",
  },
  {
    icon: Clapperboard,
    title: "5. 序列编辑",
    description: "在时间线上编排分镜序列。添加转场、调整节奏，构建完整叙事。",
    features: ["时间线编辑", "转场效果", "节奏控制", "配音同步"],
    color: "bg-rose-500",
  },
  {
    icon: Rocket,
    title: "6. 导出发布",
    description: "一键导出多种格式。分享至社交平台，或导出专业格式供后续制作。",
    features: ["视频导出", "分镜 PDF", "工程文件", "云端分享"],
    color: "bg-orange-500",
  },
]

const features = [
  {
    title: "AI 辅助创作",
    description: "集成多种 AI 模型，从文生图到图生视频，让创意快速落地",
  },
  {
    title: "团队协作",
    description: "实时多人协作，评论反馈，版本控制，提升团队效率",
  },
  {
    title: "资产管理",
    description: "集中管理所有创作素材，智能标签，快速检索",
  },
  {
    title: "工作流模板",
    description: "内置多种创作模板，漫画、动画、视觉小说一键开始",
  },
]

export default function Workflow() {
  return (
    <div className="min-h-screen bg-[hsl(var(--surface))]">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-[hsl(var(--surface))]/80 backdrop-blur-md border-b border-[hsl(var(--outline-variant))]/15">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/">
            <span className="text-xl font-black text-[hsl(var(--on-surface))] tracking-tighter">
              MangaCanvas
            </span>
          </Link>
          <Link to="/">
            <Button variant="ghost" className="gap-2 text-[hsl(var(--secondary))]">
              <ArrowLeft className="w-4 h-4" />
              返回首页
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-[hsl(var(--primary))] font-bold tracking-widest uppercase text-xs mb-4 block">
            创作流程
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-[hsl(var(--on-surface))] tracking-tight mb-6">
            从创意到成品
          </h1>
          <p className="text-lg text-[hsl(var(--secondary))] max-w-2xl mx-auto mb-8">
            MangaCanvas 提供完整的视觉叙事工作流，从灵感到发布，每一步都有专业工具支持
          </p>
          <Link to="/dashboard">
            <Button className="signature-gradient text-white px-8 py-6 rounded-xl font-bold text-lg border-0">
              开始创作
            </Button>
          </Link>
        </div>
      </section>

      {/* Steps */}
      <section className="py-20 px-6 bg-[hsl(var(--surface-container-low))]">
        <div className="max-w-5xl mx-auto">
          <div className="space-y-12">
            {steps.map((step, index) => (
              <Card 
                key={step.title}
                className="p-8 border-0 bg-[hsl(var(--surface-container-lowest))] overflow-hidden relative"
              >
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  {/* Icon */}
                  <div className={`w-16 h-16 rounded-2xl ${step.color} flex items-center justify-center flex-shrink-0`}>
                    <step.icon className="w-8 h-8 text-white" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-[hsl(var(--on-surface))] mb-3">
                      {step.title}
                    </h3>
                    <p className="text-[hsl(var(--secondary))] mb-4 leading-relaxed">
                      {step.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {step.features.map((feature) => (
                        <span 
                          key={feature}
                          className="px-3 py-1 bg-[hsl(var(--surface-container-low))] rounded-full text-xs font-medium text-[hsl(var(--on-surface-variant))]"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Step Number */}
                  <div className="text-6xl font-black text-[hsl(var(--surface-container-high))] select-none">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black text-[hsl(var(--on-surface))] tracking-tight mb-4">
              为什么选择 MangaCanvas
            </h2>
            <p className="text-[hsl(var(--secondary))]">
              专为视觉叙事创作者打造的专业工具
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature) => (
              <Card 
                key={feature.title}
                className="p-8 border-0 bg-[hsl(var(--surface-container-low))] hover:bg-[hsl(var(--surface-container-high))] transition-colors"
              >
                <h3 className="text-xl font-bold text-[hsl(var(--on-surface))] mb-3">
                  {feature.title}
                </h3>
                <p className="text-[hsl(var(--secondary))] leading-relaxed">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-[hsl(var(--surface-container-low))]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-black text-[hsl(var(--on-surface))] tracking-tight mb-6">
            准备好开始了吗？
          </h2>
          <p className="text-lg text-[hsl(var(--secondary))] mb-8">
            加入数千名创作者，使用 MangaCanvas 将你的创意变为现实
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/dashboard">
              <Button className="signature-gradient text-white px-8 py-6 rounded-xl font-bold text-lg border-0 w-full sm:w-auto">
                免费开始
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="secondary" className="px-8 py-6 rounded-xl font-bold text-lg w-full sm:w-auto">
                查看定价
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[hsl(var(--outline-variant))]/15 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-[hsl(var(--secondary))]">
            © 2025 MangaCanvas. 保留所有权利。
          </p>
          <div className="flex gap-6">
            <Link to="/terms" className="text-sm text-[hsl(var(--secondary))] hover:text-[hsl(var(--primary))]">
              服务条款
            </Link>
            <Link to="/privacy" className="text-sm text-[hsl(var(--secondary))] hover:text-[hsl(var(--primary))]">
              隐私政策
            </Link>
            <Link to="/contact" className="text-sm text-[hsl(var(--secondary))] hover:text-[hsl(var(--primary))]">
              联系我们
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
