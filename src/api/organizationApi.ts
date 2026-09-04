import { appClient } from './clients/appClient'
import { requestData } from './core/response'
import type { ListData } from './types'

export interface OrganizationMemberDTO {
  userId: number
  organizationId: number
  assignedBy?: number
  joinedAt: string
  user: {
    id: number
    username: string
    email: string
    avatar: string | null
  }
}

export interface OrganizationDTO {
  id: number
  name: string
  createdBy?: number
  createdAt: string
  updatedAt: string
}

export const organizationApi = {
  /**
   * 获取组织成员列表
   * @param organizationId 组织ID
   */
  listMembers(organizationId: number) {
    return requestData<ListData<OrganizationMemberDTO>>(appClient, {
      url: `/organizations/${organizationId}/members`,
      method: 'GET',
    })
  },

  /**
   * 添加组织成员
   * @param organizationId 组织ID
   * @param payload 用户ID
   */
  addMember(organizationId: number, payload: { userId: number }) {
    return requestData<OrganizationMemberDTO>(appClient, {
      url: `/organizations/${organizationId}/members`,
      method: 'POST',
      data: payload,
    })
  },

  /**
   * 移除组织成员
   * @param organizationId 组织ID
   * @param userId 用户ID
   */
  removeMember(organizationId: number, userId: number) {
    return requestData<true>(appClient, {
      url: `/organizations/${organizationId}/members/${userId}`,
      method: 'DELETE',
    })
  },

  /**
   * 获取组织列表
   */
  list(params?: { page?: number; size?: number }) {
    return requestData<ListData<OrganizationDTO>>(appClient, {
      url: '/organizations',
      method: 'GET',
      params,
    })
  },

  /**
   * 获取组织详情
   * @param organizationId 组织ID
   */
  getById(organizationId: number) {
    return requestData<OrganizationDTO>(appClient, {
      url: `/organizations/${organizationId}`,
      method: 'GET',
    })
  },
}
