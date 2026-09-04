import { appClient } from './clients/appClient'
import { requestData } from './core/response'
import type { AuthMe, AuthPayload } from './types'

export const authApi = {
  login(payload: { email: string; password: string }) {
    return requestData<AuthPayload>(appClient, {
      url: '/auth/login',
      method: 'POST',
      data: payload,
    })
  },

  register(payload: { username: string; email: string; password: string; avatar?: string }) {
    return requestData<AuthPayload>(appClient, {
      url: '/auth/register',
      method: 'POST',
      data: payload,
    })
  },

  refresh(refreshToken: string) {
    return requestData<{ token: string; refreshToken: string }>(appClient, {
      url: '/auth/refresh',
      method: 'POST',
      data: { refreshToken },
    })
  },

  me() {
    return requestData<AuthMe>(appClient, {
      url: '/auth/me',
      method: 'GET',
    })
  },
}
