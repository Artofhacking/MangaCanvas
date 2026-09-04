import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Link, useNavigate } from "react-router-dom"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { authApi } from "@/api"
import { clearUnauthorizedRedirectFlag, getAuthToken, saveSession } from "@/lib/session"

export default function Login() {
  const { notify } = useFeedback()
  const navigate = useNavigate()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    clearUnauthorizedRedirectFlag()
    if (getAuthToken()) {
      navigate("/dashboard", { replace: true })
    }
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim() || !password.trim()) {
      notify.warning("请输入邮箱和密码")
      return
    }

    if (!isLogin && !username.trim()) {
      notify.warning("请输入用户名")
      return
    }

    setIsLoading(true)
    try {
      const payload = isLogin
        ? await authApi.login({ email, password })
        : await authApi.register({
            username,
            email,
            password,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
          })

      saveSession({
        token: payload.token,
        refreshToken: payload.refreshToken,
        user: {
          ...payload.user,
        },
      })

      notify.success(isLogin ? "登录成功" : "注册成功")
      navigate("/dashboard")
    } catch (error) {
      notify.error(error instanceof Error ? error.message : (isLogin ? "登录失败" : "注册失败"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--surface))] flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-[hsl(var(--primary))] tracking-tighter mb-2">
            MangaCanvas
          </h1>
          <p className="text-[hsl(var(--secondary))]">
            {isLogin ? "登录" : "注册"}
          </p>
        </div>

        <Card className="bg-[hsl(var(--surface-container-lowest))] border-0 p-8 rounded-2xl shadow-xl">
          {/* Toggle */}
          <div className="flex bg-[hsl(var(--surface-container-low))] p-1 rounded-xl mb-8">
            <button
              onClick={() => {
                setIsLogin(true)
              }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isLogin 
                  ? "bg-[hsl(var(--surface-container-highest))] text-[hsl(var(--on-surface))] shadow-sm" 
                  : "text-[hsl(var(--secondary))]"
              }`}
            >
              登录
            </button>
            <button
              onClick={() => {
                setIsLogin(false)
              }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                !isLogin 
                  ? "bg-[hsl(var(--surface-container-highest))] text-[hsl(var(--on-surface))] shadow-sm" 
                  : "text-[hsl(var(--secondary))]"
              }`}
            >
              注册
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-medium">用户名</label>
                <Input 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                  className="bg-[hsl(var(--surface-container-low))] border-none rounded-xl h-12"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">邮箱 / 用户名</label>
              <Input 
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                className="bg-[hsl(var(--surface-container-low))] border-none rounded-xl h-12"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">密码</label>
              <Input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="bg-[hsl(var(--surface-container-low))] border-none rounded-xl h-12"
              />
            </div>

            <Button 
              type="submit"
              disabled={isLoading}
              className="w-full h-12 signature-gradient text-white rounded-xl font-bold text-base border-0 mt-2 disabled:opacity-50"
            >
              {isLoading ? "请稍候..." : (isLogin ? "登录" : "创建账号")}
            </Button>
          </form>

        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-[hsl(var(--secondary))] mt-8">
          登录即表示你同意我们的
          <Link to="/terms" className="text-[hsl(var(--primary))] hover:underline">服务条款</Link>
          和
          <Link to="/privacy" className="text-[hsl(var(--primary))] hover:underline">隐私政策</Link>
        </p>
      </div>
    </div>
  )
}
