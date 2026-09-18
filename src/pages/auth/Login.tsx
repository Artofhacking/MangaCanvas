import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { authApi } from "@/api"
import { clearUnauthorizedRedirectFlag, getAuthToken, saveSession } from "@/lib/session"

function FeishuMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4.4 3.5h6.2c.6 0 1.1.5 1.1 1.1v5.4c0 .9-.7 1.6-1.6 1.6H5.5c-.9 0-1.6-.7-1.6-1.6V4.6c0-.6.5-1.1 1.1-1.1Zm9 6.3h6.2c.6 0 1.1.5 1.1 1.1v8.5c0 .6-.5 1.1-1.1 1.1h-5.1c-.9 0-1.6-.7-1.6-1.6V11c0-.7.5-1.2 1.1-1.2ZM4.4 13.4h6.2c.6 0 1.1.5 1.1 1.1v5.4c0 .6-.5 1.1-1.1 1.1H5.5c-.9 0-1.6-.7-1.6-1.6v-4.9c0-.6.5-1.1 1.1-1.1Zm9.1-9.9h5.1c.9 0 1.6.7 1.6 1.6v3.6c0 .9-.7 1.6-1.6 1.6h-6.2c-.6 0-1.1-.5-1.1-1.1V4.6c0-.6.5-1.1 1.1-1.1h1.1Z"
      />
    </svg>
  )
}

export default function Login() {
  const { notify } = useFeedback()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [feishuEnabled, setFeishuEnabled] = useState(false)
  const [oauthPending, setOauthPending] = useState(() => Boolean(searchParams.get("ticket")))
  const ticketHandled = useRef(false)

  useEffect(() => {
    clearUnauthorizedRedirectFlag()

    const oauthError = searchParams.get("oauth_error")
    if (oauthError) {
      notify.error(oauthError)
      navigate("/login", { replace: true })
      setOauthPending(false)
      return
    }

    const ticket = searchParams.get("ticket")
    if (ticket) {
      if (ticketHandled.current) return
      ticketHandled.current = true
      setOauthPending(true)
      void (async () => {
        try {
          const payload = await authApi.oauthTicket(ticket)
          saveSession({
            token: payload.token,
            refreshToken: payload.refreshToken,
            user: { ...payload.user },
          })
          notify.success("飞书登录成功")
          navigate("/projects", { replace: true })
        } catch (error) {
          ticketHandled.current = false
          notify.error(error instanceof Error ? error.message : "飞书登录失败")
          navigate("/login", { replace: true })
        } finally {
          setOauthPending(false)
        }
      })()
      return
    }

    if (getAuthToken()) {
      navigate("/projects", { replace: true })
    }
  }, [navigate, notify, searchParams])

  useEffect(() => {
    let cancelled = false
    authApi
      .oauthProviders()
      .then((data) => {
        if (!cancelled) {
          setFeishuEnabled(data.providers.some((item) => item.id === "feishu" && item.enabled))
        }
      })
      .catch(() => {
        if (!cancelled) setFeishuEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim() || !password.trim()) {
      notify.warning("请输入邮箱和密码")
      return
    }

    setIsLoading(true)
    try {
      const payload = await authApi.login({ email, password })

      saveSession({
        token: payload.token,
        refreshToken: payload.refreshToken,
        user: {
          ...payload.user,
        },
      })

      notify.success("登录成功")
      navigate("/projects")
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "登录失败")
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
            {oauthPending ? "正在完成飞书登录" : "登录"}
          </p>
        </div>

        <Card className="bg-[hsl(var(--surface-container-lowest))] border-0 p-8 rounded-2xl shadow-xl">
          {oauthPending ? (
            <p className="text-center text-sm text-[hsl(var(--secondary))] py-6">正在验证飞书账号…</p>
          ) : (
            <>
          <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
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
              disabled={isLoading || oauthPending}
              className="w-full h-12 signature-gradient text-white rounded-xl font-bold text-base border-0 mt-2 disabled:opacity-50"
            >
              {isLoading || oauthPending ? "请稍候..." : "登录"}
            </Button>
          </form>
          <p className="text-center text-xs text-[hsl(var(--secondary))] mt-4">
            暂不开放公开注册，请使用已有账号登录
          </p>

          {feishuEnabled && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-[hsl(var(--outline-variant))]/50" />
                </div>
                <div className="relative flex justify-center text-xs text-[hsl(var(--secondary))]">
                  <span className="bg-[hsl(var(--surface-container-lowest))] px-3">或</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={isLoading || oauthPending}
                onClick={async () => {
                  setIsLoading(true)
                  try {
                    const payload = await authApi.oauthUrl("feishu", window.location.origin)
                    window.location.assign(payload.url)
                  } catch (error) {
                    notify.error(error instanceof Error ? error.message : "无法发起飞书登录")
                    setIsLoading(false)
                  }
                }}
                className="w-full h-12 rounded-xl border-none bg-[hsl(var(--surface-container-low))] text-[hsl(var(--on-surface))] font-medium"
              >
                <FeishuMark />
                使用飞书登录
              </Button>
            </>
          )}
            </>
          )}

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
