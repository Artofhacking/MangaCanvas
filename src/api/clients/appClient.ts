import { message } from 'antd'
import { createHttpClient } from '@/api/core'
import { DEFAULT_APP_API_BASE_URL, getAppApiConfig } from '@/api/core'
import { redirectToLogin } from '@/lib/session'

export const appClient = createHttpClient({
  baseURL: DEFAULT_APP_API_BASE_URL,
  timeout: 300000,
  headers: {
    'Content-Type': 'application/json',
  },
  resolveBaseURL: () => getAppApiConfig().baseURL,
  resolveHeaders: () => {
    const { authToken } = getAppApiConfig()

    if (!authToken) {
      return {}
    }

    return {
      Authorization: `Bearer ${authToken}`,
    }
  },
  onError: (error) => {
    if (error.status === 401) {
      redirectToLogin('expired')
      return
    }

    message.error(error.message)
  },
})
