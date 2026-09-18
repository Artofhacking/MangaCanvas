import { workflowsApi } from '@/features/project/api/workflows'
import { useCanvasStore } from '@/features/infinite-canvas/stores/canvasStore'
import { useCanvasDocumentsStore } from '@/features/infinite-canvas/stores/projectsStore'

export function persistOpenCanvas(options?: { projectId?: string | number; workflowId?: string }) {
  const canvas = useCanvasStore.getState()
  const docs = useCanvasDocumentsStore.getState()
  const workflowId = options?.workflowId || canvas.currentProjectId
  if (!workflowId) return
  docs.updateProjectCanvas(workflowId, {
    nodes: canvas.nodes,
    edges: canvas.edges,
    viewport: canvas.viewport,
  })
  const numericProjectId = Number(options?.projectId ?? docs.getProjectById(workflowId)?.projectId)
  if (!numericProjectId) return
  void workflowsApi.update(numericProjectId, workflowId, {
    canvasData: {
      nodes: canvas.nodes,
      edges: canvas.edges,
      viewport: canvas.viewport,
    },
  })
}
