import { useCallback } from "react"

import { useFeedback } from "@/components/feedback/FeedbackProvider"
import { workflowsApi } from "@/features/project/api/workflows"
import { useCanvasDocumentsStore } from "@/features/infinite-canvas/stores/projectsStore"
import { createWorkflowId, createWorkflowName, createWorkflowPath } from "@/lib/workflows"
import type { WorkflowSourceType } from "@/types"
import { useNavigate } from "react-router-dom"

interface LaunchWorkflowOptions {
  projectId: string
  sourceType: WorkflowSourceType
  sourceName?: string
  sourceAssetId?: number
  successMessage?: string
}

export const useWorkflowLauncher = () => {
  const navigate = useNavigate()
  const { notify } = useFeedback()
  const { createWorkflowDocument } = useCanvasDocumentsStore()

  return useCallback(
    async ({
      projectId,
      sourceType,
      sourceName,
      sourceAssetId,
      successMessage = "已创建新的工作流画布",
    }: LaunchWorkflowOptions) => {
      const name = createWorkflowName(sourceType, sourceName)
      const canvasData = {
        nodes: [],
        edges: [],
        viewport: { x: 100, y: 50, zoom: 0.8 },
      }
      let workflowId = createWorkflowId()
      const numericProjectId = Number(projectId)

      if (!Number.isNaN(numericProjectId) && numericProjectId > 0) {
        const response = await workflowsApi.create(numericProjectId, {
          name,
          sourceType: sourceType as 'blank' | 'episode' | 'scene' | 'character' | 'object',
          sourceAssetId,
          canvasData,
        })
        if (!response.success || !response.data?.id) {
          notify.error(response.message || "创建工作流失败")
          return
        }
        workflowId = response.data.id
      }

      createWorkflowDocument({
        id: workflowId,
        name,
        projectId,
        sourceType,
        sourceAssetId,
        canvasData,
      })

      navigate(createWorkflowPath(projectId, workflowId))
      notify.success(successMessage)
    },
    [createWorkflowDocument, navigate, notify]
  )
}
