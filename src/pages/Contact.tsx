import { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, Mail, Send, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"

export default function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // 模拟提交延迟
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    setIsSubmitting(false)
    setIsSubmitted(true)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

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
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--primary))]/10 flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8 text-[hsl(var(--primary))]" />
            </div>
            <h1 className="text-3xl font-black text-[hsl(var(--on-surface))] tracking-tight mb-3">
              联系我们
            </h1>
            <p className="text-[hsl(var(--secondary))]">
              有任何问题或建议？我们很乐意听取您的意见
            </p>
          </div>

          {isSubmitted ? (
            <Card className="p-8 text-center border-0 bg-[hsl(var(--surface-container-low))]">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-[hsl(var(--on-surface))] mb-3">
                消息已发送
              </h2>
              <p className="text-[hsl(var(--secondary))] mb-6">
                感谢您与我们联系！我们会在 24 小时内回复您的邮件。
              </p>
              <Button 
                onClick={() => {
                  setIsSubmitted(false)
                  setFormData({ name: "", email: "", subject: "", message: "" })
                }}
                className="signature-gradient text-white border-0"
              >
                发送新消息
              </Button>
            </Card>
          ) : (
            <Card className="p-8 border-0 bg-[hsl(var(--surface-container-low))]">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[hsl(var(--on-surface))]">
                      姓名 <span className="text-red-500">*</span>
                    </label>
                    <Input
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="您的姓名"
                      required
                      className="h-11 bg-[hsl(var(--surface-container-lowest))] border-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[hsl(var(--on-surface))]">
                      邮箱 <span className="text-red-500">*</span>
                    </label>
                    <Input
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="your@email.com"
                      required
                      className="h-11 bg-[hsl(var(--surface-container-lowest))] border-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[hsl(var(--on-surface))]">
                    主题 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder="消息主题"
                    required
                    className="h-11 bg-[hsl(var(--surface-container-lowest))] border-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[hsl(var(--on-surface))]">
                    消息内容 <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="请详细描述您的问题或建议..."
                    required
                    rows={5}
                    className="bg-[hsl(var(--surface-container-lowest))] border-none resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 signature-gradient text-white font-bold border-0"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      发送中...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Send className="w-4 h-4" />
                      发送消息
                    </span>
                  )}
                </Button>
              </form>
            </Card>
          )}

          {/* Contact Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <Card className="p-6 text-center border-0 bg-[hsl(var(--surface-container-low))]">
              <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center mx-auto mb-3">
                <Mail className="w-5 h-5 text-[hsl(var(--primary))]" />
              </div>
              <h3 className="font-semibold text-[hsl(var(--on-surface))] mb-1">邮件支持</h3>
              <p className="text-sm text-[hsl(var(--secondary))]">support@mangacanvas.com</p>
            </Card>
            <Card className="p-6 text-center border-0 bg-[hsl(var(--surface-container-low))]">
              <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-[hsl(var(--primary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </div>
              <h3 className="font-semibold text-[hsl(var(--on-surface))] mb-1">在线客服</h3>
              <p className="text-sm text-[hsl(var(--secondary))]">工作日 9:00-18:00</p>
            </Card>
            <Card className="p-6 text-center border-0 bg-[hsl(var(--surface-container-low))]">
              <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-[hsl(var(--primary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-[hsl(var(--on-surface))] mb-1">紧急响应</h3>
              <p className="text-sm text-[hsl(var(--secondary))]">2小时内回复</p>
            </Card>
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
            <Link to="/privacy" className="text-sm text-[hsl(var(--secondary))] hover:text-[hsl(var(--primary))]">
              隐私政策
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
