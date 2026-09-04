/**
 * 统一聊天服务
 *
 * 两条链路：
 *  - DashScope Compatible（qwen-plus 等） → /dashscope-compatible/chat/completions
 *  - 后端代理 → /api/v1/chat/completions
 *
 * 支持流式（AsyncGenerator）和同步两种调用方式。
 */

import {
  buildBearerAuthHeader,
  getAppApiConfig,
  getDashScopeCompatibleConfig,
  needBrowserAuthHeader,
  getResponseReader,
  parseJsonResponse,
} from '@/api'
import type { ChatOptions } from './types'

// ==================== 内部工具 ====================

function getOptionalAuthHeader(token: string): Record<string, string> {
  if (!token) return {}
  return buildBearerAuthHeader(token, '未登录')
}

function getDashScopeHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (needBrowserAuthHeader()) {
    const { apiKey } = getDashScopeCompatibleConfig()
    Object.assign(headers, buildBearerAuthHeader(apiKey, '请在设置中配置 DashScope API Key'))
  }
  return headers
}

// ==================== 流式输出解析 ====================

async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<string, void, undefined> {
  const decoder = new TextDecoder()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter((l) => l.trim() !== '')

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6)
        if (payload === '[DONE]') continue

        try {
          const json = JSON.parse(payload)
          const content = json.choices?.[0]?.delta?.content
          if (content) yield content
        } catch {
          // 忽略单条 SSE 解析失败
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// ==================== 公开接口 ====================

export const chatService = {
  /**
   * DashScope 流式聊天（qwen-plus 等）
   */
  async *streamDashScope(
    options: ChatOptions,
    signal?: AbortSignal,
  ): AsyncGenerator<string, void, undefined> {
    const { baseURL } = getDashScopeCompatibleConfig()
    const headers = getDashScopeHeaders()

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...options, stream: true }),
      signal,
    })
    const reader = await getResponseReader(response, 'DashScope 流式请求失败')
    yield* parseSSEStream(reader)
  },

  /**
   * 后端代理流式聊天
   */
  async *streamBackend(
    options: ChatOptions,
    signal?: AbortSignal,
  ): AsyncGenerator<string, void, undefined> {
    const { authToken, baseURL } = getAppApiConfig()

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getOptionalAuthHeader(authToken),
      },
      body: JSON.stringify({ ...options, stream: true }),
      signal,
    })
    const reader = await getResponseReader(response, '聊天流式请求失败')
    yield* parseSSEStream(reader)
  },

  /**
   * 后端代理同步聊天
   */
  async complete(options: ChatOptions): Promise<string> {
    const { authToken, baseURL } = getAppApiConfig()

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getOptionalAuthHeader(authToken),
      },
      body: JSON.stringify({ ...options, stream: false }),
    })

    const json = await parseJsonResponse<{
      choices?: Array<{ message?: { content?: string } }>
    }>(response, '聊天请求失败')

    return json.choices?.[0]?.message?.content || ''
  },
}
