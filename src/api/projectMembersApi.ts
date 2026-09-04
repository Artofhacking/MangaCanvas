import { appClient } from './clients/appClient'
import { requestData } from './core/response'
import type { ListData, ProjectMemberDTO } from './types'

export const projectMembersApi = {
  list(projectId: number) {
    return requestData<ListData<ProjectMemberDTO>>(appClient, {
      url: `/projects/${projectId}/members`,
      method: 'GET',
    })
  },

  add(projectId: number, payload: { userId: number; role: 'editor' | 'viewer' }) {
    return requestData<ProjectMemberDTO>(appClient, {
      url: `/projects/${projectId}/members`,
      method: 'POST',
      data: payload,
    })
  },

  updateRole(projectId: number, userId: number, role: 'owner' | 'editor' | 'viewer') {
    return requestData<ProjectMemberDTO>(appClient, {
      url: `/projects/${projectId}/members/${userId}`,
      method: 'PATCH',
      data: { role },
    })
  },

  remove(projectId: number, userId: number) {
    return requestData<true>(appClient, {
      url: `/projects/${projectId}/members/${userId}`,
      method: 'DELETE',
    })
  },
}
