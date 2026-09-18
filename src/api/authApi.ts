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

  oauthProviders() {
    return requestData<{ providers: Array<{ id: string; name: string; enabled: boolean }> }>(appClient, {
      url: '/auth/oauth/providers',
      method: 'GET',
    })
  },

  oauthUrl(provider: string, redirectUri?: string) {
    return requestData<{ url: string }>(appClient, {
      url: `/auth/oauth/${provider}/url`,
      method: 'GET',
      params: redirectUri ? { redirect_uri: redirectUri } : undefined,
    })
  },

  oauthTicket(ticket: string) {
    return requestData<AuthPayload>(appClient, {
      url: '/auth/oauth/ticket',
      method: 'POST',
      data: { ticket },
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
