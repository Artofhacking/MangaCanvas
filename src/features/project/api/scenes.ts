import type { Scene, SceneCreateData } from '@/types'
import type { SceneDTO } from '@/api/types'
import { mapScene } from '@/lib/projectMappers'
import { errorResponse, successResponse, toApiResponse } from './shared'
import type { ApiResponse } from './shared'

const buildScenePayload = (data: SceneCreateData) => ({
  name: data.name,
  description: data.description,
  genMethod: data.genMethod,
  modelId: data.model,
  camera: {
    distance: data.distance,
    horizontal: 0,
    vertical: 0,
    zoom: data.zoom,
  },
  referenceImages: data.referenceImage ? [data.referenceImage] : [],
  creationMode: 'quick',
})

export const scenesApi = {
  async getAll(projectId: number, status?: SceneDTO['status']): Promise<ApiResponse<Scene[]>> {
    return toApiResponse<{ list: SceneDTO[] }, never>(
      {
        url: `/projects/${projectId}/scenes`,
        method: 'GET',
        params: status ? { status } : undefined,
      },
      { list: [] },
      '获取场景列表失败',
      (data) => ({ ...data, list: data.list.map(mapScene) as unknown as SceneDTO[] })
    ).then((response) =>
      response.success ? successResponse(response.data.list as unknown as Scene[]) : errorResponse(response.message || '获取场景列表失败', [])
    )
  },

  async getById(projectId: number, id: number): Promise<ApiResponse<Scene | null>> {
    return toApiResponse<SceneDTO | null>(
      {
        url: `/projects/${projectId}/scenes/${id}`,
        method: 'GET',
      },
      null,
      '获取场景详情失败',
      (data) => (data ? (mapScene(data) as unknown as SceneDTO) : null)
    ).then((response) =>
      response.success ? successResponse((response.data as unknown as Scene | null) ?? null) : errorResponse(response.message || '获取场景详情失败', null)
    )
  },

  async create(projectId: number, data: SceneCreateData): Promise<ApiResponse<Scene>> {
    return toApiResponse<SceneDTO, ReturnType<typeof buildScenePayload>>(
      {
        url: `/projects/${projectId}/scenes`,
        method: 'POST',
        data: buildScenePayload(data),
      },
      {} as SceneDTO,
      '创建场景失败',
      (result) => mapScene(result) as unknown as SceneDTO
    ).then((response) =>
      response.success ? successResponse(response.data as unknown as Scene) : errorResponse(response.message || '创建场景失败', {} as Scene)
    )
  },

  async update(projectId: number, id: number, data: Partial<Scene>): Promise<ApiResponse<Scene | null>> {
    return toApiResponse<SceneDTO | null>(
      {
        url: `/projects/${projectId}/scenes/${id}`,
        method: 'PUT',
        data: {
          name: data.name,
          description: data.description,
          image: data.image,
          status: data.status,
        },
      },
      null,
      '更新场景失败',
      (result) => (result ? (mapScene(result) as unknown as SceneDTO) : null)
    ).then((response) =>
      response.success ? successResponse((response.data as unknown as Scene | null) ?? null) : errorResponse(response.message || '更新场景失败', null)
    )
  },

  async delete(projectId: number, id: number): Promise<ApiResponse<boolean>> {
    return toApiResponse<true>(
      {
        url: `/projects/${projectId}/scenes/${id}`,
        method: 'DELETE',
      },
      true,
      '删除场景失败'
    ).then((response) =>
      response.success ? successResponse(true) : errorResponse(response.message || '删除场景失败', false)
    )
  },

  async duplicate(projectId: number, id: number): Promise<ApiResponse<Scene | null>> {
    const sceneResponse = await this.getById(projectId, id)
    if (!sceneResponse.success || !sceneResponse.data) {
      return errorResponse(sceneResponse.message || '复制场景失败', null)
    }

    return this.create(projectId, {
      name: `${sceneResponse.data.name} (复制)`,
      genMethod: sceneResponse.data.genMethod || 'model',
      model: sceneResponse.data.model || '',
      description: sceneResponse.data.description || '',
      distance: 8,
      zoom: 0.6,
      status: 'draft',
    }).then((response) => (response.success ? successResponse(response.data) : errorResponse(response.message || '复制场景失败', null)))
  },
}
