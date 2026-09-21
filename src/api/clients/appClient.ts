import { message } from 'antd'
import { createHttpClient, isCanceledError } from '@/api/core'
import { DEFAULT_APP_API_BASE_URL, getAppApiConfig } from '@/api/core'
import { redirectToLogin } from '@/lib/session'

export const appClient = createHttpClient({
  baseURL: DEFAULT_APP_API_BASE_URL,
  timeout: 600000,
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
    if (isCanceledError(error)) return

    if (error.status === 401) {
      redirectToLogin('expired')
      return
    }
    const url = error.url || ''
    if (
      /\/ai\/images\/generations/.test(url) ||
      /\/ai\/videos\/generations/.test(url) ||
      /\/ai\/chat\/completions/.test(url) ||
      /\/scripts\/parse/.test(url)
    ) {
      return
    }

    message.error(error.message)
  },
})
