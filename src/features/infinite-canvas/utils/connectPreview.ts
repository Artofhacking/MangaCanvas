export function getSourceHandleScreenPoint(nodeId: string): { x: number; y: number } | null {
  const nodeEl = document.querySelector(`.react-flow__node[data-id="${CSS.escape(nodeId)}"]`)
  const handle = nodeEl?.querySelector<HTMLElement>('.react-flow__handle-source')
  if (!handle) return null
  const rect = handle.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

export function buildScreenBezier(
  from: { x: number; y: number },
  to: { x: number; y: number }
): string {
  const dx = Math.max(Math.abs(to.x - from.x) * 0.5, 48)
  return `M ${from.x},${from.y} C ${from.x + dx},${from.y} ${to.x - dx},${to.y} ${to.x},${to.y}`
}
