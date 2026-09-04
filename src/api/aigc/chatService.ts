import { appClient } from '@/api/clients/appClient'
import { requestData } from '@/api/core/response'
import type { ChatOptions } from './types'

export const chatService = {
  async complete(options: ChatOptions): Promise<string> {
    const json = await requestData<{
      choices?: Array<{ message?: { content?: string } }>
    }>(appClient, {
      url: '/ai/chat/completions',
      method: 'POST',
      data: {
        model: options.model,
        messages: options.messages,
        stream: false,
      },
    })
    return json.choices?.[0]?.message?.content || ''
  },

  async *streamDashScope(options: ChatOptions): AsyncGenerator<string, void, undefined> {
    const text = await this.complete(options)
    if (text) yield text
  },

  async *streamBackend(options: ChatOptions): AsyncGenerator<string, void, undefined> {
    const text = await this.complete(options)
    if (text) yield text
  },
}
