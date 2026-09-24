type TextEditFocusListener = (nodeId: string | null) => void

const listeners = new Set<TextEditFocusListener>()
let pendingNodeId: string | null = null
let editingNodeId: string | null = null

/**
 * Open the text edit bar for this node and focus it.
 * Selecting a text note does not call this — a single click only selects.
 */
export function requestTextEditFocus(nodeId: string) {
  pendingNodeId = nodeId
  editingNodeId = nodeId
  listeners.forEach((listener) => listener(nodeId))
}

export function getTextEditNodeId(): string | null {
  return editingNodeId
}

/** Edit dock is shown only for the text node that was explicitly opened. */
export function resolveTextEditTarget(
  selectedId: string | null,
  editingId: string | null,
): string | null {
  if (!selectedId || selectedId !== editingId) return null
  return selectedId
}

export function clearTextEditFocus(nodeId?: string) {
  if (nodeId && editingNodeId !== nodeId) return
  if (editingNodeId == null && pendingNodeId == null) return
  editingNodeId = null
  if (!nodeId || pendingNodeId === nodeId) pendingNodeId = null
  listeners.forEach((listener) => listener(null))
}

export function consumePendingTextEditFocus(nodeId: string): boolean {
  if (pendingNodeId !== nodeId) return false
  pendingNodeId = null
  return true
}

export function subscribeTextEditFocus(listener: TextEditFocusListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
