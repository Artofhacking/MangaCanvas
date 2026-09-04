import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { useCanvasDocumentsStore } from '@/features/infinite-canvas/stores/projectsStore'
import {
  createWorkflowPath,
  openOrCreateWorkflow,
  type OpenWorkflowOptions,
} from '@/lib/workflows'

export const useWorkflowLauncher = () => {
  const navigate = useNavigate()
  const { notify } = useFeedback()
  const { createWorkflowDocument } = useCanvasDocumentsStore()

  return useCallback(
    async (options: OpenWorkflowOptions & { successMessage?: string }) => {
      const result = await openOrCreateWorkflow(options)
      if (!result) {
        notify.error('打开工作流失败')
        return null
      }

      createWorkflowDocument({
        id: result.id,
        name: result.name,
        projectId: options.projectId,
        sourceType: options.sourceType,
        sourceAssetId: options.sourceAssetId,
        canvasData: result.canvasData as never,
      })

      navigate(createWorkflowPath(options.projectId, result.id))
      notify.success(
        options.successMessage || (result.created ? '已创建新的工作流画布' : '已打开工作流')
      )
      return result
    },
    [createWorkflowDocument, navigate, notify]
  )
}
