export interface CanvasSidebarWorkflow {
  id: string
  nodeCount?: number
}

/**
 * Canvas sidebar hides workflows that are actually empty.
 * The open document stays visible so a blank canvas you just created
 * does not disappear while you are still editing it.
 * A missing nodeCount is unknown, not empty, so those rows stay listed.
 */
export function canvasSidebarWorkflows<T extends CanvasSidebarWorkflow>(
  workflows: T[],
  currentWorkflowId?: string | null,
): T[] {
  return workflows.filter(
    (item) => item.id === currentWorkflowId || item.nodeCount !== 0,
  )
}

/** Label for 「N 节点」. Missing counts stay blank instead of rendering a fake zero. */
export function workflowNodeCountLabel(nodeCount: number | undefined): string | null {
  if (typeof nodeCount !== 'number' || !Number.isFinite(nodeCount)) return null
  return `${nodeCount} 节点`
}
