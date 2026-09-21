export const NODE_DOCK_BAR_GAP = 6
export const NODE_DOCK_MIN_LEFT = 76
export const NODE_DOCK_FLIP_OVERFLOW = 48
export const NODE_DOCK_FLIP_BIAS = 24

export interface NodeDockAnchor {
  id: string
  left: number
  top: number
  width: number
  height: number
}

export interface NodeDockSize {
  width: number
  height: number
}

export interface NodeDockContainer {
  width: number
  height: number
}

export interface NodeDockPosition {
  left: number
  top: number
  placeAbove: boolean
}

type SelectableNode = {
  id: string
  type?: string | null
  selected?: boolean
}

/** Exactly one selected node matching `match`; otherwise null (no multi-select chrome). */
export function exactlySelectedNodeId(
  nodes: SelectableNode[],
  match: (type?: string | null) => boolean
): string | null {
  const selected = nodes.filter((node) => match(node.type) && Boolean(node.selected))
  return selected.length === 1 ? selected[0].id : null
}

export function isTextNoteType(type?: string | null): boolean {
  return type === 'text'
}

/**
 * Dock a floating bar under a selected card. Flip above only when the bar
 * would clip badly below *and* the space above is meaningfully larger.
 */
export function computeNodeDockPosition(
  anchor: NodeDockAnchor,
  barSize: NodeDockSize,
  container: NodeDockContainer,
  gap = NODE_DOCK_BAR_GAP
): NodeDockPosition {
  const spaceBelow = container.height - (anchor.top + anchor.height)
  const spaceAbove = anchor.top
  const overflowBelow = barSize.height + gap - spaceBelow
  const placeAbove = overflowBelow > NODE_DOCK_FLIP_OVERFLOW && spaceAbove > spaceBelow + NODE_DOCK_FLIP_BIAS
  const left = Math.min(
    Math.max(anchor.left + anchor.width / 2 - barSize.width / 2, NODE_DOCK_MIN_LEFT),
    Math.max(NODE_DOCK_MIN_LEFT, container.width - barSize.width - 16)
  )
  const top = placeAbove
    ? Math.max(16, anchor.top - barSize.height - gap)
    : Math.min(anchor.top + anchor.height + gap, container.height - 24)

  return { left, top, placeAbove }
}
