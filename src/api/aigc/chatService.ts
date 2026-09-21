import { appClient } from '@/api/clients/appClient'
import { requestData } from '@/api/core/response'
import { applyBillingPayload, withIdempotentGenerate, type BillingPayload } from '@/lib/billing'
import { resolveProjectId } from '@/lib/session'
import type { ChatOptions } from './types'

export const chatService = {
  async complete(options: ChatOptions): Promise<string> {
    const json = await withIdempotentGenerate((idempotencyKey) =>
      requestData<{
        choices?: Array<{ message?: { content?: string } }>
        billing?: BillingPayload
      }>(appClient, {
        url: '/ai/chat/completions',
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        data: {
          model: options.model,
          messages: options.messages,
          stream: false,
          projectId: resolveProjectId(),
        },
      })
    )
    applyBillingPayload(json.billing)
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
