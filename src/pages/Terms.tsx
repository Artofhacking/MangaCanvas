import { Link } from "react-router-dom"
import { ArrowLeft, Scale } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Terms() {
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
              <Scale className="w-6 h-6 text-[hsl(var(--primary))]" />
            </div>
            <h1 className="text-3xl font-black text-[hsl(var(--on-surface))] tracking-tight">
              服务条款
            </h1>
          </div>

          <div className="prose prose-sm max-w-none text-[hsl(var(--on-surface))]/80">
            <p className="text-[hsl(var(--secondary))] mb-8">最后更新日期：2025年4月5日</p>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-[hsl(var(--on-surface))] mb-4">1. 服务概述</h2>
              <p className="leading-relaxed mb-4">
                MangaCanvas（以下简称"本平台"）是一款面向漫画创作者和视觉叙事艺术家的在线创作工具。
                通过使用本平台的服务，您同意遵守本服务条款的所有规定。
              </p>
              <p className="leading-relaxed">
                我们保留随时修改、暂停或终止服务的权利，而无需事先通知。对于服务的任何修改、暂停或终止，
                我们不对您或任何第三方承担责任。
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-[hsl(var(--on-surface))] mb-4">2. 用户账户</h2>
              <p className="leading-relaxed mb-4">
                使用本平台的部分功能需要注册账户。您有责任维护账户密码的机密性，
                并对发生在您账户下的所有活动负责。
              </p>
              <p className="leading-relaxed">
                您同意在注册时提供真实、准确、最新和完整的信息，并在信息变更时及时更新。
                如果我们有合理理由怀疑您提供的信息不真实或不完整，我们有权暂停或终止您的账户。
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-[hsl(var(--on-surface))] mb-4">3. 知识产权</h2>
              <p className="leading-relaxed mb-4">
                您保留对您在本平台上创作和上传的所有内容的知识产权。我们不会声称拥有您的原创作品的所有权。
              </p>
              <p className="leading-relaxed mb-4">
                通过上传内容到本平台，您授予我们非独占的、全球性的、免版税的许可，
                允许我们使用、复制、修改、创建衍生作品、展示和分发您的内容，
                 solely for the purpose of operating and improving our services.
              </p>
              <p className="leading-relaxed">
                您声明并保证您拥有或已获得必要的权利、许可、同意和许可，
                可以分享和授权我们使用您的内容。
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-[hsl(var(--on-surface))] mb-4">4. 禁止行为</h2>
              <p className="leading-relaxed mb-4">使用本平台时，您同意不会：</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>违反任何适用的法律或法规</li>
                <li>侵犯他人的知识产权或其他权利</li>
                <li>上传或传播任何非法、有害、威胁、辱骂、骚扰、诽谤、色情或其他令人反感的内容</li>
                <li>试图未经授权访问本平台的任何部分或与之连接的系统或网络</li>
                <li>干扰或破坏服务的完整性或性能</li>
                <li>使用任何自动化系统或软件从本平台提取数据</li>
                <li>冒充他人或提供虚假信息</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-[hsl(var(--on-surface))] mb-4">5. 服务费用</h2>
              <p className="leading-relaxed mb-4">
                本平台提供免费的入门计划，同时也提供付费的专业和企业计划。
                付费计划的具体功能和价格请查看我们的定价页面。
              </p>
              <p className="leading-relaxed">
                所有付费订阅均按照您选择的价格和期限进行计费。除非您在订阅期结束前取消，
                否则订阅将自动续订。您可以随时在账户设置中取消订阅。
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-[hsl(var(--on-surface))] mb-4">6. 责任限制</h2>
              <p className="leading-relaxed mb-4">
                在法律允许的最大范围内，我们不对任何间接、附带、特殊、后果性或惩罚性损害承担责任，
                包括但不限于利润损失、数据丢失、商誉损失或其他无形损失。
              </p>
              <p className="leading-relaxed">
                我们对所有索赔的总责任不超过您在过去 12 个月内为使用本平台服务而支付的金额，
                或者如果您没有支付任何费用，则不超过 100 美元。
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-[hsl(var(--on-surface))] mb-4">7. 条款修改</h2>
              <p className="leading-relaxed">
                我们保留随时修改本服务条款的权利。修改后的条款将在本页面上发布，
                并在页面顶部标明最后更新日期。继续使用本平台即表示您接受修改后的条款。
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-[hsl(var(--on-surface))] mb-4">8. 联系我们</h2>
              <p className="leading-relaxed">
                如果您对这些服务条款有任何疑问，请通过以下方式联系我们：
              </p>
              <p className="mt-4">
                <strong>邮箱：</strong> legal@mangacanvas.com
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
