import { message } from 'antd'
import { createHttpClient, getDashScopeApiKey, needBrowserAuthHeader } from '@/api/core'

const errorMessageMap: Record<string, string> = {
  'For i2i model, the last message must contain exactly one text content item': '图生图模式需要输入提示词描述',
  'Got 0 text items': '请输入提示词描述',
  'rate limit exceeded': '请求过于频繁，请稍后重试',
  'invalid api key': 'API Key 无效，请检查配置',
  'insufficient quota': '配额不足，请检查账户余额',
  InvalidParameter: '参数无效',
  Throttling: '请求过于频繁，请稍后重试',
  'inappropriate content': '输入内容可能包含不当内容，请修改后重试',
  'Input data may contain inappropriate content': '输入内容可能包含不当内容，请修改后重试',
  DataInspectionFailed: '内容审核未通过，请修改后重试',
}

export const translateDashScopeErrorMessage = (message: string): string => {
  if (!message) {
    return '请求失败'
  }

  if (errorMessageMap[message]) {
    return errorMessageMap[message]
  }

  for (const [key, value] of Object.entries(errorMessageMap)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return value
    }
  }

  return message
}

export const dashscopeClient = createHttpClient({
  baseURL: 'https://dashscope.aliyuncs.com/api/v1',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
  showErrorMessage: true,
  mapErrorMessage: (rawMessage) => translateDashScopeErrorMessage(rawMessage),
  resolveHeaders: () => {
    if (!needBrowserAuthHeader()) {
      return {}
    }

    const apiKey = getDashScopeApiKey()
    if (!apiKey) {
      throw new Error('请在设置中配置 DashScope API Key')
    }

    return {
      Authorization: `Bearer ${apiKey}`,
    }
  },
  onError: (error) => {
    message.error(error.message)
  },
})
