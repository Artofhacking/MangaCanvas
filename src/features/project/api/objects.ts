import type { ObjectCreateData, ObjectItem } from '@/types'
import type { ObjectDTO } from '@/api/types'
import { mapObject } from '@/lib/projectMappers'
import { errorResponse, successResponse, toApiResponse } from './shared'
import type { ApiResponse } from './shared'

const inferObjectType = (data: ObjectCreateData): ObjectDTO['type'] => {
  if (data.genMethod === 'upload') {
    return 'prop'
  }
  return 'prop'
}

const buildObjectPayload = (data: ObjectCreateData) => ({
  name: data.name,
  type: inferObjectType(data),
  description: data.prompt || '',
  image: data.referenceImage,
  genMethod: data.genMethod,
  referenceImages: data.referenceImages || (data.referenceImage ? [data.referenceImage] : []),
  creationMode: data.creationMode || 'quick',
  sourceWorkflowId: data.sourceWorkflowId,
  sourceNodeId: data.sourceNodeId,
  aspectRatio: data.aspectRatio,
})

export const objectsApi = {
  async getAll(projectId: number, type?: ObjectDTO['type']): Promise<ApiResponse<ObjectItem[]>> {
    return toApiResponse<{ list: ObjectDTO[] }, never>(
      {
        url: `/projects/${projectId}/objects`,
        method: 'GET',
        params: type ? { type } : undefined,
      },
      { list: [] },
      '获取物品列表失败',
      (data) => ({ ...data, list: data.list.map(mapObject) as unknown as ObjectDTO[] })
    ).then((response) =>
      response.success ? successResponse(response.data.list as unknown as ObjectItem[]) : errorResponse(response.message || '获取物品列表失败', [])
    )
  },

  async getById(projectId: number, id: number): Promise<ApiResponse<ObjectItem | null>> {
    return toApiResponse<ObjectDTO | null>(
      {
        url: `/projects/${projectId}/objects/${id}`,
        method: 'GET',
      },
      null,
      '获取物品详情失败',
      (data) => (data ? (mapObject(data) as unknown as ObjectDTO) : null)
    ).then((response) =>
      response.success ? successResponse((response.data as unknown as ObjectItem | null) ?? null) : errorResponse(response.message || '获取物品详情失败', null)
    )
  },

  async create(projectId: number, data: ObjectCreateData): Promise<ApiResponse<ObjectItem>> {
    return toApiResponse<ObjectDTO, ReturnType<typeof buildObjectPayload>>(
      {
        url: `/projects/${projectId}/objects`,
        method: 'POST',
        data: buildObjectPayload(data),
      },
      {} as ObjectDTO,
      '创建物品失败',
      (result) => mapObject(result) as unknown as ObjectDTO
    ).then((response) =>
      response.success ? successResponse(response.data as unknown as ObjectItem) : errorResponse(response.message || '创建物品失败', {} as ObjectItem)
    )
  },

  async update(projectId: number, id: number, data: Partial<ObjectItem>): Promise<ApiResponse<ObjectItem | null>> {
    return toApiResponse<ObjectDTO | null>(
      {
        url: `/projects/${projectId}/objects/${id}`,
        method: 'PUT',
        data: {
          name: data.name,
          description: data.description,
          image: data.image,
          status: data.status,
          ...(data.aspectRatio ? { aspectRatio: data.aspectRatio } : {}),
        },
      },
      null,
      '更新物品失败',
      (result) => (result ? (mapObject(result) as unknown as ObjectDTO) : null)
    ).then((response) =>
      response.success ? successResponse((response.data as unknown as ObjectItem | null) ?? null) : errorResponse(response.message || '更新物品失败', null)
    )
  },

  async setPromptLock(projectId: number, id: number, locked: boolean): Promise<ApiResponse<ObjectItem | null>> {
    return toApiResponse<ObjectDTO | null>(
      {
        url: `/projects/${projectId}/objects/${id}/prompt-lock`,
        method: 'POST',
        data: { locked },
      },
      null,
      locked ? '锁定提示词失败' : '解锁提示词失败',
      (result) => (result ? (mapObject(result) as unknown as ObjectDTO) : null)
    ).then((response) =>
      response.success
        ? successResponse((response.data as unknown as ObjectItem | null) ?? null)
        : errorResponse(response.message || (locked ? '锁定提示词失败' : '解锁提示词失败'), null)
    )
  },

  async delete(projectId: number, id: number): Promise<ApiResponse<boolean>> {
    return toApiResponse<true>(
      {
        url: `/projects/${projectId}/objects/${id}`,
        method: 'DELETE',
      },
      true,
      '删除物品失败'
    ).then((response) =>
      response.success ? successResponse(true) : errorResponse(response.message || '删除物品失败', false)
    )
  },
}
