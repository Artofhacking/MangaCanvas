import type { WorkflowSourceType } from "@/types"

const sourceLabelMap: Record<WorkflowSourceType, string> = {
  blank: "空白",
  episode: "片段",
  scene: "场景",
  character: "角色",
  object: "物品",
}

export const createWorkflowId = () =>
  `workflow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const createWorkflowPath = (projectId: string, workflowId: string) =>
  `/project/${projectId}/workflows/${workflowId}`

export const createWorkflowName = (
  sourceType: WorkflowSourceType,
  sourceName?: string
) => {
  if (sourceName?.trim()) {
    return `${sourceName} 工作流`
  }

  return `${sourceLabelMap[sourceType]}工作流`
}
