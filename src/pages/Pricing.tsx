import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Sparkles, Zap, Building2, ArrowRight } from "lucide-react"
import { Link } from "react-router-dom"

const plans = [
  {
    name: "图像",
    price: "5–152",
    period: "积分/张",
    description: "按模型和画质计价，成功出图才扣",
    icon: Sparkles,
    features: [
      "GPT Image 2 medium：39 积分/张",
      "万相 2.7 / 千问：20 积分/张",
      "Pro 档：50 积分/张",
      "失败、占位图不扣分",
    ],
    cta: "查看账单",
    popular: false,
  },
  {
    name: "视频",
    price: "按秒",
    period: "计费",
    description: "HappyHorse 与其它渠道按秒×分辨率",
    icon: Zap,
    features: [
      "HappyHorse 5 秒 720p：600 积分（待发票校准）",
      "时长仅 5 / 10 / 15 秒",
      "生成失败会退回预扣",
      "由管理员发放积分使用",
    ],
    cta: "查看账单",
    popular: true,
  },
  {
    name: "文本",
    price: "1–78",
    period: "积分/次",
    description: "润色和剧本解析按次计价",
    icon: Building2,
    features: [
      "提示词润色：1–2 积分",
      "剧本 LLM 解析：4 或 78 积分",
      "规则拆解不扣费",
      "不支持支付宝 / 微信自助充值",
    ],
    cta: "联系管理员",
    popular: false,
  },
]

const faqs = [
  {
    q: "如何获得积分？",
    a: "目前只由超级管理员发放。登录后打开「积分账单」，超管可用邮箱查找用户并充值。",
  },
  {
    q: "失败会扣分吗？",
    a: "不会。系统会先预扣，只有拿到真实结果才入账；失败、超时、占位图会退回。",
  },
  {
    q: "支持支付宝或微信支付吗？",
    a: "v1 不支持在线支付，也没有月费套餐。",
  },
  {
    q: "1 积分等于多少钱？",
    a: "内部计价单位，1 积分对应 ¥0.01 的刊例换算，不能兑现实货币。",
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
              按次消耗积分
            </h1>
            <p className="text-xl text-[hsl(var(--secondary))] max-w-2xl mx-auto">
              成功才扣分。积分由管理员发放，没有月费和在线支付。
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

                <Link to="/billing">
                  <Button
                    className={`w-full py-6 rounded-xl font-bold text-base transition-all ${
                      plan.popular
                        ? "signature-gradient text-white hover:opacity-90"
                        : "bg-[hsl(var(--surface-container-high))] text-[hsl(var(--on-surface))] hover:bg-[hsl(var(--surface-container-highest))]"
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </Card>
            ))}
          </div>

          {/* Enterprise CTA */}
          <Card className="bg-[hsl(var(--on-surface))] text-[hsl(var(--surface))] p-10 rounded-2xl mb-24">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div>
                <h2 className="text-3xl font-black mb-3">需要充值？</h2>
                <p className="text-[hsl(var(--secondary-fixed-dim))] text-lg">
                  请联系工作室超级管理员发放积分。登录后可在「积分账单」查看余额和流水。
                </p>
              </div>
              <Link to="/billing">
                <Button className="bg-white text-[hsl(var(--on-surface))] hover:bg-[hsl(var(--surface-container-high))] px-8 py-6 rounded-xl font-bold text-base flex items-center gap-2">
                  打开账单
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
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
              © 2024 MangaCanvas. All rights reserved.
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
