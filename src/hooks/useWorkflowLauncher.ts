import { useCallback } from "react"

import { useFeedback } from "@/components/feedback/FeedbackProvider"
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
    ({
      projectId,
      sourceType,
      sourceName,
      sourceAssetId,
      successMessage = "已创建新的工作流画布",
    }: LaunchWorkflowOptions) => {
      const workflowId = createWorkflowId()

      createWorkflowDocument({
        id: workflowId,
        name: createWorkflowName(sourceType, sourceName),
        projectId,
        sourceType,
        sourceAssetId,
      })

      navigate(createWorkflowPath(projectId, workflowId))
      notify.success(successMessage)
    },
    [createWorkflowDocument, navigate, notify]
  )
}
