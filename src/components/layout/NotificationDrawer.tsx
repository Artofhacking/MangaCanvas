import { useEffect, useState } from "react"
import { Bell, Check, Trash2, X } from "lucide-react"

import GenerationHistoryList from "@/components/layout/GenerationHistoryList"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

type DrawerTab = "messages" | "history"

const DRAWER_TABS: { id: DrawerTab; label: string }[] = [
  { id: "messages", label: "消息列表" },
  { id: "history", label: "生成历史" },
]

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
  const [activeTab, setActiveTab] = useState<DrawerTab>("messages")
  const isMessagesTab = activeTab === "messages"

  useEffect(() => {
    if (open) setActiveTab("messages")
  }, [open])

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
                {isMessagesTab && unreadCount > 0 && (
                  <span className="text-xs text-[hsl(var(--primary))]">{unreadCount} 条未读</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {isMessagesTab ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onMarkAllAsRead}
                    className="h-8 px-2 text-xs text-[hsl(var(--secondary))] hover:text-[hsl(var(--on-surface))]"
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    全部已读
                  </Button>
                ) : null}
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
            <div className="mt-3 flex gap-2" role="tablist" aria-label="消息通知分类">
              {DRAWER_TABS.map((tab) => {
                const selected = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                      selected
                        ? "signature-gradient text-white shadow-sm"
                        : "bg-[hsl(var(--surface-container-high))] text-[hsl(var(--on-surface))] hover:bg-[hsl(var(--surface-container-highest))]"
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className={`relative min-h-0 flex-1 px-3 py-2 ${isMessagesTab ? "overflow-y-auto" : "overflow-hidden"}`}>
            {isMessagesTab ? (
              notifications.length === 0 ? (
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
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3
                              className={`truncate text-sm font-bold ${
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
                          <p className="mt-0.5 line-clamp-2 text-xs text-[hsl(var(--on-surface-variant))]">
                            {notification.message}
                          </p>
                        </div>
                      </div>
                      <p className="mt-2 text-[10px] text-[hsl(var(--secondary))]">{notification.time}</p>
                    </button>
                  ))}
                </div>
              )
            ) : (
              <GenerationHistoryList />
            )}
          </div>

          {isMessagesTab ? (
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
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
