import type { ModelDTO, ModelModality } from '@/api/types'
import { errorResponse, successResponse, toApiResponse } from '@/features/project/api/shared'
import type { ApiResponse } from '@/features/project/api/shared'

export const modelsApi = {
  /**
   * 获取模型列表
   * @param modality 模型类型: 'text' | 'image' | 'video' | 'audio' | 'multimodal'
   * @returns 模型列表
   */
  async getModels(modality?: ModelModality): Promise<ApiResponse<ModelDTO[]>> {
    return toApiResponse<Record<string, unknown>, never>(
      {
        url: '/ai/models',
        method: 'GET',
        params: modality ? { modality } : undefined,
      },
      {},
      '获取模型列表失败',
      (data) => data
    ).then((response) => {
      if (!response.success) {
        return errorResponse(response.message || '获取模型列表失败', [])
      }

      const data = response.data as unknown
      let rawModels: unknown[] = []
      if (Array.isArray(data)) {
        rawModels = data
      } else if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>
        if (Array.isArray(obj.data)) rawModels = obj.data
        else if (Array.isArray(obj.models)) rawModels = obj.models
        else if (Array.isArray(obj.list)) rawModels = obj.list
      }

      if (rawModels.length === 0) {
        return successResponse([])
      }

      const models = rawModels.map((m: unknown): ModelDTO => {
        const model = m as Record<string, unknown>
        const id = String(model.model_id || model.id || '')
        return {
          id,
          model_id: String(model.model_id || id),
          name: String(model.name || id),
          provider: String(model.provider || model.owned_by || 'unknown'),
          modality: (String(model.modality || '') || modality || '') as ModelModality,
          description: String(model.modality_label || model.description || ''),
          isEnabled: model.status === 'active' || model.isEnabled !== false,
          status: String(model.status || ''),
        }
      })

      return successResponse(models)
    })
  },

  /**
   * 获取单个模型详情
   * @param modelId 模型ID
   */
  async getModelById(modelId: string): Promise<ApiResponse<ModelDTO | null>> {
    return toApiResponse<ModelDTO | null>(
      {
        url: `/ai/models/${modelId}`,
        method: 'GET',
      },
      null,
      '获取模型详情失败'
    ).then((response) =>
      response.success
        ? successResponse(response.data)
        : errorResponse(response.message || '获取模型详情失败', null)
    )
  },

  /**
   * 获取支持的模型类型
   */
  getSupportedModalities(): ModelModality[] {
    return ['text', 'image', 'video', 'audio', 'embedding', 'rerank', 'multimodal']
  },
}
