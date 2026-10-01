import { useState } from "react"
import { BellOutlined } from "@ant-design/icons"

import NotificationDrawer from "@/components/layout/NotificationDrawer"
import { useGenerationHistoryStore } from "@/store/generationHistoryStore"

export default function CanvasGenerationHistoryButton() {
  const [open, setOpen] = useState(false)
  const runningCount = useGenerationHistoryStore((state) =>
    state.items.reduce((count, item) => (item.status === "running" ? count + 1 : count), 0),
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="生成历史"
        title="生成历史"
        className="relative flex h-10 items-center gap-2 rounded-xl border border-[hsl(var(--outline-variant))]/30 bg-[hsl(var(--surface-container-low))] px-3 text-sm font-medium text-[hsl(var(--on-surface))] transition-colors hover:bg-[hsl(var(--surface-container-high))]"
      >
        <BellOutlined style={{ fontSize: 16, color: "hsl(var(--primary))" }} />
        <span className="cn-nowrap">生成历史</span>
        {runningCount > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[hsl(var(--primary))] px-1 text-[10px] font-bold text-white">
            {runningCount > 9 ? "9+" : runningCount}
          </span>
        ) : null}
      </button>
      <NotificationDrawer
        open={open}
        onOpenChange={setOpen}
        preferredTab="history"
        notifications={[]}
        onMarkAllAsRead={() => undefined}
        onMarkAsRead={() => undefined}
        onClearAll={() => undefined}
      />
    </>
  )
}
