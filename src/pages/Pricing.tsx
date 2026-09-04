import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Sparkles, Zap, Building2, ArrowRight } from "lucide-react"
import { Link } from "react-router-dom"

const plans = [
  {
    name: "免费版",
    price: "¥0",
    period: "/月",
    description: "适合个人创作者入门体验",
    icon: Sparkles,
    features: [
      "每月 10 次场景生成",
      "基础角色库 (5个角色)",
      "2GB 存储空间",
      "基础导出格式 (PNG/JPG)",
      "社区支持",
    ],
    cta: "免费开始",
    popular: false,
  },
  {
    name: "专业版",
    price: "¥99",
    period: "/月",
    description: "适合专业创作者和工作室",
    icon: Zap,
    features: [
      "每月 200 次场景生成",
      "无限角色库",
      "50GB 存储空间",
      "高清导出 (4K)",
      "批量导出功能",
      "优先客服支持",
      "团队协作 (3人)",
    ],
    cta: "立即升级",
    popular: true,
  },
  {
    name: "企业版",
    price: "¥399",
    period: "/月",
    description: "适合大型团队和制片公司",
    icon: Building2,
    features: [
      "无限场景生成",
      "无限角色库",
      "无限存储空间",
      "8K 超清导出",
      "API 接口访问",
      "私有部署选项",
      "专属客户经理",
      "团队协作 (20人)",
    ],
    cta: "联系销售",
    popular: false,
  },
]

const faqs = [
  {
    q: "可以随时取消订阅吗？",
    a: "是的，您可以随时取消订阅，取消后将在当前计费周期结束时生效。",
  },
  {
    q: "免费版有使用期限吗？",
    a: "免费版永久有效，但每月有生成次数限制。",
  },
  {
    q: "支持哪些支付方式？",
    a: "支持支付宝、微信支付、银联卡以及企业银行转账。",
  },
  {
    q: "可以申请退款吗？",
    a: "购买后 7 天内如有问题可申请退款，详情请联系客服。",
  },
]

export default function Pricing() {
  return (
    <div className="min-h-screen bg-[hsl(var(--surface))]">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 glass-effect bg-[hsl(var(--surface))]/80 shadow-[0_40px_40px_rgba(27,28,28,0.04)]">
        <div className="flex justify-between items-center px-8 h-20 w-full max-w-7xl mx-auto">
          <Link to="/" className="text-2xl font-black text-[hsl(var(--primary))] tracking-tighter">
            MangaCanvas
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost">控制台</Button>
            </Link>
            <Link to="/login">
              <Button className="signature-gradient text-white px-6 rounded-xl border-0">
                登录
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-20 px-8">
        <div className="max-w-6xl mx-auto">
          {/* Title */}
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-black text-[hsl(var(--on-surface))] tracking-tighter mb-6">
              选择适合你的方案
            </h1>
            <p className="text-xl text-[hsl(var(--secondary))] max-w-2xl mx-auto">
              无论你是个人创作者还是专业团队，都能找到合适的方案
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative p-8 rounded-2xl border-0 transition-all duration-300 hover:-translate-y-1 ${
                  plan.popular
                    ? "bg-[hsl(var(--surface-container-lowest))] shadow-2xl shadow-[hsl(var(--primary))]/10 ring-2 ring-[hsl(var(--primary))]"
                    : "bg-[hsl(var(--surface-container-low))] hover:shadow-xl"
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 signature-gradient text-white border-0 px-4 py-1">
                    最受欢迎
                  </Badge>
                )}

                <div className="text-center mb-8">
                  <div className={`w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center ${
                    plan.popular ? "bg-[hsl(var(--primary))] text-white" : "bg-[hsl(var(--surface-container-high))] text-[hsl(var(--primary))]"
                  }`}>
                    <plan.icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-[hsl(var(--on-surface))] mb-2">{plan.name}</h3>
                  <p className="text-sm text-[hsl(var(--secondary))] mb-4">{plan.description}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-black text-[hsl(var(--on-surface))]">{plan.price}</span>
                    <span className="text-[hsl(var(--secondary))]">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm">
                      <Check className="w-5 h-5 text-[hsl(var(--primary))] flex-shrink-0 mt-0.5" />
                      <span className="text-[hsl(var(--on-surface))]">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full py-6 rounded-xl font-bold text-base transition-all ${
                    plan.popular
                      ? "signature-gradient text-white hover:opacity-90"
                      : "bg-[hsl(var(--surface-container-high))] text-[hsl(var(--on-surface))] hover:bg-[hsl(var(--surface-container-highest))]"
                  }`}
                >
                  {plan.cta}
                </Button>
              </Card>
            ))}
          </div>

          {/* Enterprise CTA */}
          <Card className="bg-[hsl(var(--on-surface))] text-[hsl(var(--surface))] p-10 rounded-2xl mb-24">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div>
                <h2 className="text-3xl font-black mb-3">需要更多？</h2>
                <p className="text-[hsl(var(--secondary-fixed-dim))] text-lg">
                  我们提供定制化企业解决方案，包括私有化部署、专属培训和技术支持
                </p>
              </div>
              <Button className="bg-white text-[hsl(var(--on-surface))] hover:bg-[hsl(var(--surface-container-high))] px-8 py-6 rounded-xl font-bold text-base flex items-center gap-2">
                联系我们
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          </Card>

          {/* FAQ */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-black text-center text-[hsl(var(--on-surface))] mb-12">
              常见问题
            </h2>
            <div className="space-y-4">
              {faqs.map((faq, idx) => (
                <div
                  key={idx}
                  className="bg-[hsl(var(--surface-container-low))] rounded-xl p-6"
                >
                  <h3 className="font-bold text-[hsl(var(--on-surface))] mb-2">{faq.q}</h3>
                  <p className="text-[hsl(var(--secondary))]">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[hsl(var(--surface))] border-t border-[hsl(var(--outline-variant))]/15 py-12 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div>
            <span className="text-xl font-black text-[hsl(var(--on-surface))]">MangaCanvas</span>
            <p className="text-xs text-[hsl(var(--secondary))] mt-1">
              © 2024 Kinetic Gallery. All rights reserved.
            </p>
          </div>
          <div className="flex gap-8">
            <Link to="/" className="text-sm text-[hsl(var(--secondary))] hover:text-[hsl(var(--primary))]">
              首页
            </Link>
            <Link to="/dashboard" className="text-sm text-[hsl(var(--secondary))] hover:text-[hsl(var(--primary))]">
              控制台
            </Link>
            <Link to="/login" className="text-sm text-[hsl(var(--secondary))] hover:text-[hsl(var(--primary))]">
              登录
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
