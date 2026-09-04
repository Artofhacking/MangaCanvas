import { useState } from "react"
import { Input } from "@/components/ui/input"
import NotificationDrawer, { demoNotifications } from "@/components/layout/NotificationDrawer"
import UserProfileMenu from "@/components/layout/UserProfileMenu"
import { Search, Bell } from "lucide-react"

import type { ProjectTab } from "@/types"

interface ProjectHeaderProps {
  activeTab: ProjectTab
  onTabChange: (tab: ProjectTab) => void
}

export default function ProjectHeader({
  activeTab,
  onTabChange,
}: ProjectHeaderProps) {
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notificationList, setNotificationList] = useState(demoNotifications)
  
  const unreadCount = notificationList.filter((n) => !n.read).length
  
  const markAllAsRead = () => {
    setNotificationList((prev) => prev.map((n) => ({ ...n, read: true })))
  }
  
  const markAsRead = (id: number) => {
    setNotificationList((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  const topTabs: { id: ProjectTab; label: string }[] = [
    { id: "episodes", label: "片段管理" },
    { id: "characters", label: "角色管理" },
    { id: "scenes", label: "场景管理" },
    { id: "objects", label: "物品管理" },
    { id: "workflows", label: "工作流" },
  ]

  return (
    <header className="workspace-fixed-header fixed top-0 z-40 flex h-16 items-center justify-between border-b border-[hsl(var(--outline-variant))]/15 bg-[hsl(var(--surface-container-lowest))]/80 px-8 backdrop-blur-md">
      {/* Left spacer for balance */}
      <div className="w-48" />

      {/* Capsule Navigation */}
      <nav className="hidden lg:flex items-center bg-[hsl(var(--surface-container-low))] rounded-full p-1">
        {topTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            aria-current={activeTab === tab.id ? "page" : undefined}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "signature-gradient text-white shadow-md"
                : "text-[hsl(var(--on-secondary-fixed-variant))] hover:text-[hsl(var(--on-surface))] hover:bg-[hsl(var(--surface-container-high))]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--secondary))] w-4 h-4" />
          <Input 
            placeholder="搜索资源..." 
            className="pl-10 pr-4 py-1.5 bg-[hsl(var(--surface-container-low))] rounded-full text-sm border-none focus:ring-0 focus:bg-[hsl(var(--surface-container-lowest))] transition-all w-48"
          />
        </div>
        <button 
          className="relative w-9 h-9 flex items-center justify-center rounded-full text-[hsl(var(--secondary))] hover:text-[hsl(var(--on-surface))] hover:bg-[hsl(var(--surface-container-high))] transition-colors"
          onClick={() => setNotificationOpen(true)}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
        <div className="h-4 w-[1px] bg-[hsl(var(--outline-variant))]" />
        {/* User Profile Hover Menu */}
        <UserProfileMenu />
      </div>

      <NotificationDrawer
        open={notificationOpen}
        onOpenChange={setNotificationOpen}
        notifications={notificationList}
        onMarkAllAsRead={markAllAsRead}
        onMarkAsRead={markAsRead}
        onClearAll={() => setNotificationList([])}
      />
    </header>
  )
}
