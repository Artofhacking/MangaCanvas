import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SimpleHoverMenu } from "@/components/ui/hover-menu"
import { useFeedback } from "@/components/feedback/FeedbackProvider"
import {
  getIdentityMeta,
  getStoredIdentity,
  identityOptions,
  setStoredIdentity,
  getIdentityByRoleId,
  clearSession,
  clearActiveProjectId,
  getCurrentUser,
  getUserRoleId,
  type IdentityOption,
} from "@/lib/session"
import { cn } from "@/lib/utils"
import { ChevronDown, Check, LogOut, Shield, User } from "lucide-react"

interface UserProfileMenuProps {
  userName?: string
  avatarSrc?: string
  avatarFallback?: string
  triggerClassName?: string
}

export default function UserProfileMenu({
  userName,
  avatarSrc,
  avatarFallback,
  triggerClassName,
}: UserProfileMenuProps) {
  const navigate = useNavigate()
  const { notify } = useFeedback()
  // 从后端 roleId 初始化身份，如果没有则使用存储的身份
  const getInitialIdentity = (): IdentityOption => {
    const roleId = getUserRoleId()
    if (roleId) {
      return getIdentityByRoleId(roleId)
    }
    return getStoredIdentity()
  }
  
  const [currentIdentity, setCurrentIdentity] = useState<IdentityOption>(getInitialIdentity)
  const [identityPanelOpen, setIdentityPanelOpen] = useState(false)
  const identityLeaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionUser = getCurrentUser()
  const resolvedUserName = userName || sessionUser?.username || "未登录用户"
  const resolvedAvatarSrc =
    avatarSrc ||
    sessionUser?.avatar ||
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop"
  const resolvedAvatarFallback = avatarFallback || resolvedUserName.slice(0, 1) || "U"

  const openIdentityPanel = () => {
    if (identityLeaveTimeoutRef.current) {
      clearTimeout(identityLeaveTimeoutRef.current)
      identityLeaveTimeoutRef.current = null
    }
    setIdentityPanelOpen(true)
  }

  const closeIdentityPanel = () => {
    if (identityLeaveTimeoutRef.current) {
      clearTimeout(identityLeaveTimeoutRef.current)
    }
    identityLeaveTimeoutRef.current = setTimeout(() => {
      setIdentityPanelOpen(false)
      identityLeaveTimeoutRef.current = null
    }, 180)
  }

  useEffect(() => {
    return () => {
      if (identityLeaveTimeoutRef.current) {
        clearTimeout(identityLeaveTimeoutRef.current)
      }
    }
  }, [])

  const handleIdentityChange = (identity: string) => {
    const nextIdentity = identity as IdentityOption
    setCurrentIdentity(nextIdentity)
    setStoredIdentity(nextIdentity)
    notify.success(`已切换为${getIdentityMeta(nextIdentity).label}`)
  }

  const getIdentityIcon = (identity: IdentityOption) => {
    switch (identity) {
      case "superadmin":
        return Shield
      case "admin":
        return Shield
      case "employee":
        return User
      default:
        return User
    }
  }

  return (
    <SimpleHoverMenu
      align="end"
      contentClassName="overflow-visible border-none bg-transparent p-0 shadow-none"
      trigger={
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-[hsl(var(--surface-container-high))]",
            triggerClassName,
          )}
        >
          <Avatar className="h-9 w-9">
            <AvatarImage src={resolvedAvatarSrc} alt={resolvedUserName} />
            <AvatarFallback>{resolvedAvatarFallback}</AvatarFallback>
          </Avatar>
          <div className="hidden text-left md:block">
            <p className="text-sm font-bold text-[hsl(var(--on-surface))]">{resolvedUserName}</p>
            <p className="text-[10px] text-[hsl(var(--secondary))]">
              {getIdentityMeta(currentIdentity).label}
            </p>
          </div>
          <ChevronDown className="hidden h-4 w-4 text-[hsl(var(--secondary))] md:block" />
        </div>
      }
    >
      <div className="w-[196px] rounded-[20px] border border-[hsl(var(--outline-variant))]/15 bg-[hsl(var(--surface-container-lowest))] p-3 shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
        <div className="px-1 pb-3 text-[13px] font-medium tracking-[0.03em] text-[hsl(var(--on-surface))]">
          个人中心
        </div>
        <div className="h-px bg-[hsl(var(--outline-variant))]/20" />

        <button
          onClick={() => notify.info("个人中心开发中")}
          className="mt-3 flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2 text-left text-[13px] font-medium text-[hsl(var(--on-surface))] transition-colors hover:bg-[hsl(var(--surface-container-high))]"
        >
          <User className="h-4 w-4 shrink-0" strokeWidth={2.2} />
          <span>我的主页</span>
        </button>

        <div
          className="relative mt-2"
          onMouseEnter={openIdentityPanel}
          onMouseLeave={closeIdentityPanel}
        >
          <button className="flex w-full items-center rounded-[14px] bg-[hsl(var(--surface-container-high))] px-3 py-2 text-left text-[13px] font-medium text-[hsl(var(--on-surface))]">
            <Shield className="mr-2.5 h-4 w-4 shrink-0" strokeWidth={2.2} />
            <span className="flex-1">切换身份</span>
            <ChevronDown className="h-[13px] w-[13px] shrink-0 -rotate-90 text-[hsl(var(--secondary))]" strokeWidth={2.4} />
          </button>

          {identityPanelOpen ? (
            <>
              <div
                aria-hidden="true"
                className="absolute right-full top-0 z-[59] h-full w-2"
              />
              <div className="absolute right-[calc(100%+6px)] top-0 z-[60] w-[168px] rounded-[18px] border border-[hsl(var(--outline-variant))]/15 bg-[hsl(var(--surface-container-lowest))] p-2 shadow-[0_12px_28px_rgba(15,23,42,0.10)]">
                {identityOptions.map((option, index) => {
                  const Icon = getIdentityIcon(option.id)
                  const isActive = currentIdentity === option.id

                  return (
                    <button
                      key={option.id}
                      onClick={() => {
                        handleIdentityChange(option.id)
                        setIdentityPanelOpen(false)
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2 text-left text-[13px] font-medium transition-colors",
                        isActive
                          ? "bg-[hsl(var(--primary))] text-white"
                          : "text-[hsl(var(--on-surface))] hover:bg-[hsl(var(--surface-container-high))]",
                        index > 0 && "mt-2",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={2.2} />
                      <span className="flex-1">{option.label}</span>
                      {isActive ? <Check className="h-3 w-3 shrink-0" strokeWidth={2.6} /> : null}
                    </button>
                  )
                })}
              </div>
            </>
          ) : null}
        </div>

        <div className="mt-3 h-px bg-[hsl(var(--outline-variant))]/20" />

        <button
          onClick={() => {
            clearSession()
            clearActiveProjectId()
            navigate("/login")
            notify.success("已退出登录")
          }}
          className="mt-3 flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2 text-left text-[13px] font-medium text-[#ff4d4f] transition-colors hover:bg-[#fff1f0]"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={2.2} />
          <span>退出登录</span>
        </button>
      </div>
    </SimpleHoverMenu>
  )
}
