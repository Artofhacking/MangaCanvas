import type { Workflow } from '@/types'
import type { WorkflowDTO, WorkflowMemberDTO, CreateWorkflowInput, UpdateWorkflowInput } from '@/api/types'
import { errorResponse, successResponse, toApiResponse } from './shared'
import type { ApiResponse } from './shared'

interface ListData<T> {
  list: T[]
  pagination?: {
    page: number
    size: number
    total: number
  }
}

/**
 * 将后端 WorkflowDTO 映射为前端 Workflow 类型
 */
const mapWorkflow = (dto: WorkflowDTO): Workflow => ({
  id: dto.id,
  projectId: String(dto.projectId),
  name: dto.name,
  sourceType: (dto.sourceType as Workflow['sourceType']) || 'blank',
  sourceAssetId: dto.sourceAssetId ?? undefined,
  status: (dto.status as Workflow['status']) || 'draft',
  modified: dto.updatedAt || dto.createdAt || new Date().toISOString(),
  thumbnail: dto.thumbnail ?? undefined,
  canvasData: dto.canvasData,
})

export const workflowsApi = {
  /**
   * 获取工作流列表
   */
  async getAll(
    projectId: number,
    params?: { page?: number; size?: number }
  ): Promise<ApiResponse<ListData<Workflow>>> {
    return toApiResponse<ListData<WorkflowDTO>, never>(
      {
        url: `/projects/${projectId}/canvas-workflows`,
        method: 'GET',
        params,
      },
      { list: [] },
      '获取工作流列表失败'
    ).then((response) =>
      response.success
        ? successResponse({
            list: response.data.list.map(mapWorkflow),
            pagination: response.data.pagination,
          })
        : errorResponse(response.message || '获取工作流列表失败', { list: [] })
    )
  },

  /**
   * 获取工作流详情
   */
  async getById(projectId: number, id: string): Promise<ApiResponse<Workflow | null>> {
    return toApiResponse<WorkflowDTO | null>(
      {
        url: `/projects/${projectId}/canvas-workflows/${id}`,
        method: 'GET',
      },
      null,
      '获取工作流详情失败'
    ).then((response) =>
      response.success
        ? successResponse(response.data ? mapWorkflow(response.data) : null)
        : errorResponse(response.message || '获取工作流详情失败', null)
    )
  },

  /**
   * 创建工作流
   * POST /projects/{projectId}/canvas-workflows
   */
  async create(
    projectId: number,
    data: CreateWorkflowInput
  ): Promise<ApiResponse<Workflow>> {
    return toApiResponse<WorkflowDTO, CreateWorkflowInput>(
      {
        url: `/projects/${projectId}/canvas-workflows`,
        method: 'POST',
        data,
      },
      {} as WorkflowDTO,
      '创建工作流失败'
    ).then((response) =>
      response.success
        ? successResponse(mapWorkflow(response.data))
        : errorResponse(response.message || '创建工作流失败', {} as Workflow)
    )
  },

  /**
   * 更新/保存工作流
   * PUT /projects/{projectId}/canvas-workflows/{workflowId}
   */
  async update(
    projectId: number,
    workflowId: string,
    data: UpdateWorkflowInput
  ): Promise<ApiResponse<Workflow | null>> {
    return toApiResponse<WorkflowDTO, UpdateWorkflowInput>(
      {
        url: `/projects/${projectId}/canvas-workflows/${workflowId}`,
        method: 'PUT',
        data,
      },
      {} as WorkflowDTO,
      '保存工作流失败'
    ).then((response) =>
      response.success
        ? successResponse(mapWorkflow(response.data))
        : errorResponse(response.message || '保存工作流失败', null)
    )
  },

  /**
   * 删除工作流
   */
  async delete(projectId: number, id: string): Promise<ApiResponse<boolean>> {
    return toApiResponse<true>(
      {
        url: `/projects/${projectId}/canvas-workflows/${id}`,
        method: 'DELETE',
      },
      true,
      '删除工作流失败'
    ).then((response) =>
      response.success ? successResponse(true) : errorResponse(response.message || '删除工作流失败', false)
    )
  },

  // ==================== 工作流成员管理 ====================

  /**
   * 获取工作流成员列表
   * GET /projects/{projectId}/canvas-workflows/{workflowId}/members
   */
  async listMembers(
    projectId: number,
    workflowId: string
  ): Promise<ApiResponse<WorkflowMemberDTO[]>> {
    return toApiResponse<{ list: WorkflowMemberDTO[] }, never>(
      {
        url: `/projects/${projectId}/canvas-workflows/${workflowId}/members`,
        method: 'GET',
      },
      { list: [] },
      '获取工作流成员列表失败'
    ).then((response) =>
      response.success
        ? successResponse(response.data.list)
        : errorResponse(response.message || '获取工作流成员列表失败', [])
    )
  },

  /**
   * 添加工作流成员
   * POST /projects/{projectId}/canvas-workflows/{workflowId}/members
   */
  async addMember(
    projectId: number,
    workflowId: string,
    data: { userId: number; role: 'editor' | 'viewer' }
  ): Promise<ApiResponse<WorkflowMemberDTO>> {
    return toApiResponse<WorkflowMemberDTO, { userId: number; role: 'editor' | 'viewer' }>(
      {
        url: `/projects/${projectId}/canvas-workflows/${workflowId}/members`,
        method: 'POST',
        data,
      },
      {} as WorkflowMemberDTO,
      '添加工作流成员失败'
    ).then((response) =>
      response.success
        ? successResponse(response.data)
        : errorResponse(response.message || '添加工作流成员失败', {} as WorkflowMemberDTO)
    )
  },

  /**
   * 更新工作流成员角色
   * PATCH /projects/{projectId}/canvas-workflows/{workflowId}/members/{userId}
   */
  async updateMemberRole(
    projectId: number,
    workflowId: string,
    userId: number,
    role: 'editor' | 'viewer'
  ): Promise<ApiResponse<WorkflowMemberDTO>> {
    return toApiResponse<WorkflowMemberDTO, { role: 'editor' | 'viewer' }>(
      {
        url: `/projects/${projectId}/canvas-workflows/${workflowId}/members/${userId}`,
        method: 'PATCH',
        data: { role },
      },
      {} as WorkflowMemberDTO,
      '更新工作流成员角色失败'
    ).then((response) =>
      response.success
        ? successResponse(response.data)
        : errorResponse(response.message || '更新工作流成员角色失败', {} as WorkflowMemberDTO)
    )
  },

  /**
   * 移除工作流成员
   * DELETE /projects/{projectId}/canvas-workflows/{workflowId}/members/{userId}
   */
  async removeMember(
    projectId: number,
    workflowId: string,
    userId: number
  ): Promise<ApiResponse<boolean>> {
    return toApiResponse<true>(
      {
        url: `/projects/${projectId}/canvas-workflows/${workflowId}/members/${userId}`,
        method: 'DELETE',
      },
      true,
      '移除工作流成员失败'
    ).then((response) =>
      response.success
        ? successResponse(true)
        : errorResponse(response.message || '移除工作流成员失败', false)
    )
  },
}
