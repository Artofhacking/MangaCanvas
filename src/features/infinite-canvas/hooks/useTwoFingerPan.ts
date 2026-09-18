import { useEffect, useRef, type RefObject } from "react"
import { useReactFlow, useStoreApi } from "reactflow"

function midpoint(touches: TouchList) {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  }
}

export function useTwoFingerPan(containerRef: RefObject<HTMLElement | null>) {
  const { getViewport, setViewport } = useReactFlow()
  const store = useStoreApi()
  const lastMidpoint = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onStart = (event: TouchEvent) => {
      if (event.touches.length < 2) return
      lastMidpoint.current = midpoint(event.touches)
      store.setState({
        userSelectionActive: false,
        userSelectionRect: null,
      })
    }

    const onMove = (event: TouchEvent) => {
      if (event.touches.length < 2 || !lastMidpoint.current) return
      event.preventDefault()
      const next = midpoint(event.touches)
      const dx = next.x - lastMidpoint.current.x
      const dy = next.y - lastMidpoint.current.y
      lastMidpoint.current = next
      const viewport = getViewport()
      setViewport({ x: viewport.x + dx, y: viewport.y + dy, zoom: viewport.zoom }, { duration: 0 })
    }

    const onEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) lastMidpoint.current = null
    }

    el.addEventListener("touchstart", onStart, { capture: true, passive: true })
    el.addEventListener("touchmove", onMove, { capture: true, passive: false })
    el.addEventListener("touchend", onEnd, { capture: true })
    el.addEventListener("touchcancel", onEnd, { capture: true })

    return () => {
      el.removeEventListener("touchstart", onStart, true)
      el.removeEventListener("touchmove", onMove, true)
      el.removeEventListener("touchend", onEnd, true)
      el.removeEventListener("touchcancel", onEnd, true)
    }
  }, [containerRef, getViewport, setViewport, store])
}
