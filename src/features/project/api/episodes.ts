import type { Episode, EpisodeCreateData } from '@/types'
import type { EpisodeDTO } from '@/api/types'
import { mapEpisode } from '@/lib/projectMappers'
import { errorResponse, successResponse, toApiResponse } from './shared'
import type { ApiResponse } from './shared'

const buildEpisodeCreatePayload = (data: EpisodeCreateData, code?: string) => ({
  name: data.folderName,
  code: code || `EP_${Date.now()}`,
  description: data.description,
  duration: Number(data.episodeCount) || 0,
  characterIds: [],
  sceneIds: [],
  objectIds: [],
  creationMode: 'quick',
  sourceWorkflowId: null,
  sourceNodeId: null,
})

export const episodesApi = {
  async getAll(projectId: number, status?: EpisodeDTO['status']): Promise<ApiResponse<Episode[]>> {
    return toApiResponse<{ list: EpisodeDTO[] }, never>(
      {
        url: `/projects/${projectId}/episodes`,
        method: 'GET',
        params: status ? { status } : undefined,
      },
      { list: [] },
      '获取片段列表失败',
      (data) => ({ ...data, list: data.list.map(mapEpisode) as unknown as EpisodeDTO[] })
    ).then((response) =>
      response.success
        ? successResponse((response.data.list as unknown as Episode[]) || [])
        : errorResponse(response.message || '获取片段列表失败', [])
    )
  },

  async getById(projectId: number, id: number): Promise<ApiResponse<Episode | null>> {
    return toApiResponse<EpisodeDTO | null>(
      {
        url: `/projects/${projectId}/episodes/${id}`,
        method: 'GET',
      },
      null,
      '获取片段详情失败',
      (data) => (data ? (mapEpisode(data) as unknown as EpisodeDTO) : null)
    ).then((response) =>
      response.success
        ? successResponse((response.data as unknown as Episode | null) ?? null)
        : errorResponse(response.message || '获取片段详情失败', null)
    )
  },

  async create(projectId: number, data: EpisodeCreateData): Promise<ApiResponse<Episode>> {
    return toApiResponse<EpisodeDTO, ReturnType<typeof buildEpisodeCreatePayload>>(
      {
        url: `/projects/${projectId}/episodes`,
        method: 'POST',
        data: buildEpisodeCreatePayload(data),
      },
      {} as EpisodeDTO,
      '创建片段失败',
      (result) => mapEpisode(result) as unknown as EpisodeDTO
    ).then((response) =>
      response.success
        ? successResponse(response.data as unknown as Episode)
        : errorResponse(response.message || '创建片段失败', {} as Episode)
    )
  },

  async update(projectId: number, id: number, data: Partial<Episode>): Promise<ApiResponse<Episode | null>> {
    return toApiResponse<EpisodeDTO | null>(
      {
        url: `/projects/${projectId}/episodes/${id}`,
        method: 'PUT',
        data: {
          name: data.name,
          code: data.code,
          description: data.description,
          status: data.status,
        },
      },
      null,
      '更新片段失败',
      (result) => (result ? (mapEpisode(result) as unknown as EpisodeDTO) : null)
    ).then((response) =>
      response.success
        ? successResponse((response.data as unknown as Episode | null) ?? null)
        : errorResponse(response.message || '更新片段失败', null)
    )
  },

  async delete(projectId: number, id: number): Promise<ApiResponse<boolean>> {
    return toApiResponse<true>(
      {
        url: `/projects/${projectId}/episodes/${id}`,
        method: 'DELETE',
      },
      true,
      '删除片段失败'
    ).then((response) =>
      response.success ? successResponse(true) : errorResponse(response.message || '删除片段失败', false)
    )
  },

  async duplicate(projectId: number, id: number): Promise<ApiResponse<Episode | null>> {
    const episodeResponse = await this.getById(projectId, id)
    if (!episodeResponse.success || !episodeResponse.data) {
      return errorResponse(episodeResponse.message || '复制片段失败', null)
    }

    return this.create(projectId, {
      folderName: `${episodeResponse.data.name} (复制)`,
      episodeCount: String(episodeResponse.data.count),
      description: episodeResponse.data.description || '',
    }).then((response) => (response.success ? successResponse(response.data) : errorResponse(response.message || '复制片段失败', null)))
  },
}
