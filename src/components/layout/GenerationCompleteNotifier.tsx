import { useEffect } from "react"
import { notification } from "antd"
import { CheckCircle2, XCircle } from "lucide-react"

import { collectGenerationCompletions } from "@/lib/generationCompleteNotify"
import { requestNotificationDrawer } from "@/lib/notificationDrawerBridge"
import { MEDIA_TYPE_LABEL, useGenerationHistoryStore, type GenerationHistoryItem } from "@/store/generationHistoryStore"

const MAX_VISIBLE_NOTICES = 3

function snippet(item: GenerationHistoryItem) {
  const text = (item.title || item.prompt || "").trim()
  if (!text) return item.status === "failed" ? "生成失败" : "生成完成"
  return text.length > 36 ? `${text.slice(0, 36)}…` : text
}

function showGenerationNotice(item: GenerationHistoryItem) {
  const typeLabel = MEDIA_TYPE_LABEL[item.mediaType]
  const succeeded = item.status === "succeeded"
  const openHistory = () => {
    requestNotificationDrawer({ tab: "history", focusId: item.id })
    notification.destroy(item.id)
  }
  const errorText = !succeeded && item.error ? (item.error.length > 48 ? `${item.error.slice(0, 48)}…` : item.error) : ""

  notification.open({
    key: item.id,
    message: succeeded ? `${typeLabel}生成完成` : `${typeLabel}生成失败`,
    description: (
      <div>
        <div>{snippet(item)}</div>
        {errorText ? <div style={{ marginTop: 4 }}>{errorText}</div> : null}
        <div style={{ marginTop: 6, fontSize: 12, color: "hsl(var(--secondary))" }}>点击查看生成历史</div>
      </div>
    ),
    placement: "topRight",
    duration: 4.5,
    onClick: openHistory,
    icon: succeeded ? (
      <CheckCircle2 className="h-5 w-5 text-[hsl(var(--primary))]" />
    ) : (
      <XCircle className="h-5 w-5 text-red-500" />
    ),
    style: {
      borderRadius: 16,
      cursor: "pointer",
      background: "hsl(var(--surface-container-lowest))",
      border: "1px solid hsl(var(--outline-variant) / 0.35)",
      boxShadow: "0 12px 32px rgba(42, 28, 24, 0.12)",
    },
  })
}

export default function GenerationCompleteNotifier() {
  useEffect(() => {
    notification.config({
      placement: "topRight",
      maxCount: MAX_VISIBLE_NOTICES,
      top: 72,
      duration: 4.5,
    })
    return useGenerationHistoryStore.subscribe((state, previous) => {
      const events = collectGenerationCompletions(previous.items, state.items)
      events.forEach((event) => showGenerationNotice(event.item))
    })
  }, [])

  return null
}
