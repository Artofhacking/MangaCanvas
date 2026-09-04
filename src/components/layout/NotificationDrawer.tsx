import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Bell, Check, Trash2, X } from "lucide-react"

export interface NotificationItem {
  id: number
  title: string
  message: string
  time: string
  read: boolean
  type?: "success" | "info" | "warning"
}

interface NotificationDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  notifications: NotificationItem[]
  onMarkAllAsRead: () => void
  onMarkAsRead: (id: number) => void
  onClearAll: () => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const demoNotifications: NotificationItem[] = [
  {
    id: 1,
    title: "片段渲染完成",
    message: "序章：觉醒 的片段已完成渲染",
    time: "2 分钟前",
    read: false,
    type: "success",
  },
  {
    id: 2,
    title: "角色创建成功",
    message: "新角色 龙崎真治 已创建",
    time: "1 小时前",
    read: false,
    type: "info",
  },
  {
    id: 3,
    title: "AI 生成任务完成",
    message: "3 个物品图片已生成",
    time: "3 小时前",
    read: true,
    type: "success",
  },
  {
    id: 4,
    title: "团队成员邀请",
    message: "李明邀请你加入项目 赛博武士",
    time: "昨天",
    read: true,
    type: "warning",
  },
]

export default function NotificationDrawer({
  open,
  onOpenChange,
  notifications,
  onMarkAllAsRead,
  onMarkAsRead,
  onClearAll,
}: NotificationDrawerProps) {
  const unreadCount = notifications.filter((item) => !item.read).length

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        hideCloseButton
        className="w-[420px] max-w-[92vw] border-l border-[hsl(var(--outline-variant))]/20 bg-[hsl(var(--surface))] p-0"
      >
        <SheetTitle className="sr-only">消息通知</SheetTitle>
        <div className="flex h-full flex-col">
          <div className="border-b border-[hsl(var(--outline-variant))]/15 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-[hsl(var(--on-surface))]">消息通知</h2>
                {unreadCount > 0 && (
                  <span className="text-xs text-[hsl(var(--primary))]">{unreadCount} 条未读</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onMarkAllAsRead}
                  className="h-8 px-2 text-xs text-[hsl(var(--secondary))] hover:text-[hsl(var(--on-surface))]"
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  全部已读
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenChange(false)}
                  className="h-8 w-8 text-[hsl(var(--secondary))] hover:text-[hsl(var(--on-surface))]"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2">
            {notifications.length === 0 ? (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center text-[hsl(var(--secondary))]">
                <Bell className="mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm">暂无通知</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => onMarkAsRead(notification.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      notification.read
                        ? "border-transparent bg-[hsl(var(--surface-container-low))] hover:bg-[hsl(var(--surface-container-high))]"
                        : "border-[hsl(var(--primary))]/18 bg-[hsl(var(--primary))]/5 hover:bg-[hsl(var(--primary))]/8"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3
                            className={`text-sm font-bold truncate ${
                              notification.read
                                ? "text-[hsl(var(--on-surface))]"
                                : "text-[hsl(var(--primary))]"
                            }`}
                          >
                            {notification.title}
                          </h3>
                          {!notification.read && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--primary))]" />
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-[hsl(var(--on-surface-variant))] line-clamp-2">
                          {notification.message}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] text-[hsl(var(--secondary))]">{notification.time}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[hsl(var(--outline-variant))]/15 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                className="h-9 flex-1 rounded-lg text-xs text-[hsl(var(--secondary))] hover:text-[hsl(var(--on-surface))]"
                onClick={() => onOpenChange(false)}
              >
                查看全部消息
              </Button>
              <Button
                variant="ghost"
                className="h-9 rounded-lg px-3 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={onClearAll}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                清空
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
