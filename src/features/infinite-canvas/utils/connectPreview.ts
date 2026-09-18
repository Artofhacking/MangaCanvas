function centerOfElement(el: Element): { x: number; y: number } {
  const rect = el.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

export function getHandlePointFromEvent(event: {
  target?: EventTarget | null
  nativeEvent?: { target?: EventTarget | null }
}): { x: number; y: number } | null {
  const target = (event.nativeEvent?.target || event.target) as HTMLElement | null
  const handle = target?.closest?.('.react-flow__handle')
  return handle ? centerOfElement(handle) : null
}

export function getHandleScreenPoint(
  nodeId: string,
  handleType?: string | null,
  handleId?: string | null
): { x: number; y: number } | null {
  const nodeEl = document.querySelector(`.react-flow__node[data-id="${CSS.escape(nodeId)}"]`)
  if (!nodeEl) return null
  const handles = Array.from(nodeEl.querySelectorAll<HTMLElement>('.react-flow__handle'))
  const typed = handleType
    ? handles.filter(
        (el) =>
          el.classList.contains(handleType) ||
          el.classList.contains(`react-flow__handle-${handleType}`)
      )
    : handles
  const match = handleId
    ? typed.find((el) => el.getAttribute('data-handleid') === handleId) ||
      typed.find((el) => el.dataset.handleid === handleId)
    : undefined
  const handle = match || typed[0]
  return handle ? centerOfElement(handle) : null
}

type PointEventLike = {
  clientX?: number
  clientY?: number
  touches?: ArrayLike<{ clientX: number; clientY: number }>
  changedTouches?: ArrayLike<{ clientX: number; clientY: number }>
  nativeEvent?: PointEventLike
}

export function getClientPoint(event: PointEventLike): { x: number; y: number } | null {
  const source = event.nativeEvent || event
  if (typeof source.clientX === 'number' && typeof source.clientY === 'number') {
    return { x: source.clientX, y: source.clientY }
  }
  const touch = source.changedTouches?.[0] || source.touches?.[0]
  return touch ? { x: touch.clientX, y: touch.clientY } : null
}

export function buildScreenBezier(
  from: { x: number; y: number },
  to: { x: number; y: number }
): string {
  const dx = Math.max(Math.abs(to.x - from.x) * 0.5, 48)
  return `M ${from.x},${from.y} C ${from.x + dx},${from.y} ${to.x - dx},${to.y} ${to.x},${to.y}`
}
