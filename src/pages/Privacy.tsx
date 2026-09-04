import { Link } from "react-router-dom"
import { ArrowLeft, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[hsl(var(--surface))]">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-[hsl(var(--surface))]/80 backdrop-blur-md border-b border-[hsl(var(--outline-variant))]/15">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
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

      {/* Content */}
      <main className="pt-24 pb-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-[hsl(var(--primary))]" />
            </div>
            <h1 className="text-3xl font-black text-[hsl(var(--on-surface))] tracking-tight">
              隐私政策
            </h1>
          </div>

          <div className="prose prose-sm max-w-none text-[hsl(var(--on-surface))]/80">
            <p className="text-[hsl(var(--secondary))] mb-8">最后更新日期：2025年4月5日</p>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-[hsl(var(--on-surface))] mb-4">1. 引言</h2>
              <p className="leading-relaxed mb-4">
                MangaCanvas（"我们"、"我们的"或"本平台"）致力于保护您的隐私。
                本隐私政策解释了我们如何收集、使用、存储和保护您的个人信息。
              </p>
              <p className="leading-relaxed">
                使用本平台即表示您同意本隐私政策中描述的做法。如果您不同意本政策的任何部分，
                请不要使用我们的服务。
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-[hsl(var(--on-surface))] mb-4">2. 我们收集的信息</h2>
              <h3 className="text-lg font-semibold text-[hsl(var(--on-surface))] mb-3">2.1 您提供的信息</h3>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li><strong>账户信息：</strong>当您注册时，我们会收集您的姓名、电子邮件地址和密码</li>
                <li><strong>个人资料：</strong>您可以选择提供头像、个人简介和其他个人信息</li>
                <li><strong>内容：</strong>您上传到本平台的漫画作品、角色设计、场景和其他创作内容</li>
                <li><strong>通信：</strong>当您联系我们时，我们会保留通信记录</li>
              </ul>

              <h3 className="text-lg font-semibold text-[hsl(var(--on-surface))] mb-3">2.2 自动收集的信息</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>使用数据：</strong>您如何使用本平台，包括访问时间、浏览的页面和点击的操作</li>
                <li><strong>设备信息：</strong>IP 地址、浏览器类型、操作系统、设备标识符</li>
                <li><strong>Cookies：</strong>我们使用 cookies 和类似技术来增强用户体验</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-[hsl(var(--on-surface))] mb-4">3. 我们如何使用您的信息</h2>
              <p className="leading-relaxed mb-4">我们使用收集的信息用于：</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>提供、维护和改进本平台服务</li>
                <li>处理交易和管理您的账户</li>
                <li>发送服务通知和技术更新</li>
                <li>回应您的询问和提供客户支持</li>
                <li>防止欺诈和滥用，确保平台安全</li>
                <li>分析使用趋势以改进用户体验</li>
                <li>在获得您同意的情况下发送营销信息</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-[hsl(var(--on-surface))] mb-4">4. 信息的共享与披露</h2>
              <p className="leading-relaxed mb-4">
                我们不会出售您的个人信息。仅在以下情况下，我们可能会共享您的信息：
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>服务提供商：</strong>帮助我们运营业务的第三方供应商（如云服务、支付处理）</li>
                <li><strong>法律要求：</strong>响应法律程序、法院命令或政府要求</li>
                <li><strong>保护权利：</strong>保护我们、我们的用户或公众的权利、财产或安全</li>
                <li><strong>业务转让：</strong>在合并、收购或资产出售的情况下</li>
                <li><strong>经您同意：</strong>在您明确同意的情况下与其他方共享</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-[hsl(var(--on-surface))] mb-4">5. 数据安全</h2>
              <p className="leading-relaxed mb-4">
                我们采取合理的安全措施来保护您的个人信息免受未经授权的访问、使用或披露。
                这些措施包括加密、访问控制和安全审计。
              </p>
              <p className="leading-relaxed">
                然而，没有任何互联网传输或电子存储方法是 100% 安全的。
                我们无法保证绝对的安全性，但我们会持续改进我们的安全措施。
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-[hsl(var(--on-surface))] mb-4">6. 数据保留</h2>
              <p className="leading-relaxed">
                我们会在实现本隐私政策所述目的所需的期限内保留您的个人信息，
                除非法律要求或允许更长的保留期限。当您删除账户时，
                我们会在合理的时间内删除或匿名化您的个人信息，
                除非我们需要保留某些信息用于合法业务目的或法律要求。
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-[hsl(var(--on-surface))] mb-4">7. 您的权利</h2>
              <p className="leading-relaxed mb-4">根据适用的数据保护法，您可能拥有以下权利：</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>访问权：</strong>获取我们持有的关于您的个人信息的副本</li>
                <li><strong>更正权：</strong>要求更正不准确或不完整的信息</li>
                <li><strong>删除权：</strong>在特定情况下要求删除您的个人信息</li>
                <li><strong>限制处理权：</strong>在特定情况下限制我们对您信息的处理</li>
                <li><strong>数据可携带权：</strong>以结构化、通用的格式获取您的数据</li>
                <li><strong>反对权：</strong>反对我们基于合法利益处理您的信息</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-[hsl(var(--on-surface))] mb-4">8. 第三方服务</h2>
              <p className="leading-relaxed">
                我们的服务可能包含指向第三方网站或服务的链接。
                我们对这些第三方服务的隐私做法不承担责任。
                我们建议您在使用这些服务前查看其隐私政策。
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-[hsl(var(--on-surface))] mb-4">9. 儿童隐私</h2>
              <p className="leading-relaxed">
                本平台不面向 13 岁以下的儿童。我们不会故意收集 13 岁以下儿童的个人信息。
                如果您发现我们收集了 13 岁以下儿童的个人信息，请联系我们，我们会立即删除该信息。
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-[hsl(var(--on-surface))] mb-4">10. 政策更新</h2>
              <p className="leading-relaxed">
                我们可能会不时更新本隐私政策。更新后的政策将在本页面上发布，
                并在页面顶部标明最后更新日期。重大变更可能会通过电子邮件或服务内通知告知您。
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-[hsl(var(--on-surface))] mb-4">11. 联系我们</h2>
              <p className="leading-relaxed">
                如果您对本隐私政策或我们的数据处理做法有任何疑问，请通过以下方式联系我们：
              </p>
              <p className="mt-4">
                <strong>邮箱：</strong> privacy@mangacanvas.com
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[hsl(var(--outline-variant))]/15 py-8 px-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-[hsl(var(--secondary))]">
            © 2025 MangaCanvas. 保留所有权利。
          </p>
          <div className="flex gap-6">
            <Link to="/terms" className="text-sm text-[hsl(var(--secondary))] hover:text-[hsl(var(--primary))]">
              服务条款
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
