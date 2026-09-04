import { ReactNode, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import NotificationDrawer, { demoNotifications } from "@/components/layout/NotificationDrawer"
import UserProfileMenu from "@/components/layout/UserProfileMenu"
import { Bell, Search } from "lucide-react"

interface WorkspaceHeaderProps {
  title: string
  subtitle?: string
  searchPlaceholder?: string
  actions?: ReactNode
}

export default function WorkspaceHeader({
  title,
  subtitle,
  searchPlaceholder = "搜索内容...",
  actions,
}: WorkspaceHeaderProps) {
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notificationList, setNotificationList] = useState(demoNotifications)
  const unreadCount = notificationList.filter((item) => !item.read).length

  const markAllAsRead = () => {
    setNotificationList((current) => current.map((item) => ({ ...item, read: true })))
  }

  const markAsRead = (id: number) => {
    setNotificationList((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)))
  }

  return (
    <>
      <header className="workspace-fixed-header fixed top-0 z-40 h-16 border-b border-[hsl(var(--outline-variant))]/15 bg-[hsl(var(--surface-container-lowest))]/85 px-8 backdrop-blur-md">
        <div className="flex h-full items-center justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-lg font-black text-[hsl(var(--on-surface))]">{title}</h1>
            {subtitle ? <p className="text-xs text-[hsl(var(--secondary))]">{subtitle}</p> : null}
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--secondary))]" />
              <Input
                placeholder={searchPlaceholder}
                className="h-10 w-80 rounded-full border-none bg-[hsl(var(--surface-container-low))] pl-10 pr-4 text-sm focus-visible:ring-0"
              />
            </div>

            {actions}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setNotificationOpen(true)}
              className="relative text-[hsl(var(--secondary))] hover:text-[hsl(var(--on-surface))]"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 ? (
                <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[hsl(var(--primary))] px-1 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              ) : null}
            </Button>

            <div className="h-4 w-px bg-[hsl(var(--outline-variant))]" />

            <UserProfileMenu />
          </div>
        </div>
      </header>
      <NotificationDrawer
        open={notificationOpen}
        onOpenChange={setNotificationOpen}
        notifications={notificationList}
        onMarkAllAsRead={markAllAsRead}
        onMarkAsRead={markAsRead}
        onClearAll={() => setNotificationList([])}
      />
    </>
  )
}
