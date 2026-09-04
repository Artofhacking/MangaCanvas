import { appClient } from './clients/appClient'
import { requestData } from './core/response'
import type { ListData, ProjectAssetDTO } from './types'

export const projectAssetsApi = {
  list(
    projectId: number,
    params?: { page?: number; size?: number; sourceType?: ProjectAssetDTO['sourceType'] }
  ) {
    return requestData<ListData<ProjectAssetDTO>>(appClient, {
      url: `/projects/${projectId}/assets`,
      method: 'GET',
      params,
    })
  },

  create(
    projectId: number,
    payload: {
      name?: string
      sourceType: ProjectAssetDTO['sourceType']
      sourceId: string
      prompt?: string
      url: string
      metadata?: Record<string, unknown>
    }
  ) {
    return requestData<ProjectAssetDTO>(appClient, {
      url: `/projects/${projectId}/assets`,
      method: 'POST',
      data: payload,
    })
  },

  getById(projectId: number, assetId: number) {
    return requestData<ProjectAssetDTO>(appClient, {
      url: `/projects/${projectId}/assets/${assetId}`,
      method: 'GET',
    })
  },

  update(
    projectId: number,
    assetId: number,
    payload: {
      name?: string
      prompt?: string
      metadata?: Record<string, unknown>
    }
  ) {
    return requestData<ProjectAssetDTO>(appClient, {
      url: `/projects/${projectId}/assets/${assetId}`,
      method: 'PUT',
      data: payload,
    })
  },

  remove(projectId: number, assetId: number) {
    return requestData<true>(appClient, {
      url: `/projects/${projectId}/assets/${assetId}`,
      method: 'DELETE',
    })
  },
}
