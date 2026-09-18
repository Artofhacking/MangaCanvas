import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Shared collapse/expand state for the dual-column 「生成进度与结果」 panel.
 * Matches Character create/edit: default collapsed, toggle from the header button,
 * highlight when opening, reset each time the sheet opens.
 */
export function useCollapsibleTaskPanel(open: boolean) {
  const taskPanelRef = useRef<HTMLDivElement>(null)
  const [highlightTasks, setHighlightTasks] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => {
    if (open) setPanelOpen(false)
  }, [open])

  const handleOpenTaskList = useCallback(() => {
    setPanelOpen((current) => {
      const next = !current
      if (next) {
        window.setTimeout(() => {
          taskPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" })
        }, 50)
        setHighlightTasks(true)
        window.setTimeout(() => setHighlightTasks(false), 1600)
      }
      return next
    })
  }, [])

  const revealTaskPanel = useCallback(() => {
    setPanelOpen(true)
  }, [])

  return {
    panelOpen,
    highlightTasks,
    taskPanelRef,
    handleOpenTaskList,
    revealTaskPanel,
  }
}
