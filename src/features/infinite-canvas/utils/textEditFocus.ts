type TextEditFocusListener = (nodeId: string) => void

const listeners = new Set<TextEditFocusListener>()
let pendingNodeId: string | null = null

/** Ask the text edit bar to focus. Safe to call before the bar mounts. */
export function requestTextEditFocus(nodeId: string) {
  pendingNodeId = nodeId
  listeners.forEach((listener) => listener(nodeId))
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
