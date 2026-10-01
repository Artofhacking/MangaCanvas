import { appClient } from '@/api/clients/appClient'
import { HttpError, isCanceledError } from '@/api/core/error'
import { requestData } from '@/api/core/response'
import { applyBillingPayload, withIdempotentGenerate, type BillingPayload } from '@/lib/billing'
import { resolveProjectId } from '@/lib/session'
import { formatAiError } from '@/lib/formatAiError'
import { titleFromPrompt, useGenerationHistoryStore } from '@/store/generationHistoryStore'
import type { ImageGenerateOptions } from './types'

export const isDashScopeDirectModel = (model: string) => model.startsWith('wan')

/**
 * Models whose /ai/images/generations path consumes optional `images`.
 * No refs stay text-to-image; connected refs are forwarded.
 * wan2.6-image remains included. qwen and wan2.6-t2i do not accept refs.
 */
export const isI2IModel = (model: string) =>
  model === 'wan2.6-image' ||
  model === 'wan2.7-image' ||
  model === 'wan2.7-image-pro' ||
  model.startsWith('gpt-image')

export const UNSUPPORTED_REFERENCE_IMAGE_MESSAGE =
  '当前模型不支持参考图，请改用 GPT Image、万相 2.7 或万相 2.6 图生图'

export const IMAGE_GENERATION_TIMEOUT_MESSAGE = '图片生成超时，请稍后重试或减小参考图'

export function imageGenerationErrorMessage(error: unknown, fallback = '生成失败'): string {
  if (isCanceledError(error)) {
    return error instanceof Error && error.message ? error.message : '已取消'
  }
  const message = error instanceof Error ? error.message : ''
  const status = axiosStatus(error)
  const code = axiosCode(error)
  if (
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    status === 504 ||
    /timeout of \d+ms exceeded|timed out|readtimeout|图片生成超时/i.test(message)
  ) {
    return IMAGE_GENERATION_TIMEOUT_MESSAGE
  }
  return formatAiError(message || fallback, fallback)
}

function axiosStatus(error: unknown): number | undefined {
  if (error instanceof HttpError) return error.status
  if (error && typeof error === 'object' && 'response' in error) {
    const status = (error as { response?: { status?: number } }).response?.status
    if (typeof status === 'number') return status
  }
  return undefined
}

function axiosCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return ''
  return String((error as { code?: unknown }).code || '')
}

/** Attach refs for i2i-capable models; never silently drop them. */
export function resolveImageReferences(
  model: string,
  images?: Array<string | undefined>
): { images?: string[]; error?: string } {
  const refs = (images || []).filter((item): item is string => Boolean(item))
  if (!refs.length) return {}
  if (isI2IModel(model)) return { images: refs }
  return { error: UNSUPPORTED_REFERENCE_IMAGE_MESSAGE }
}

interface BackendImageResponse {
  created: number
  data: { url?: string; b64_json?: string }[]
  billing?: BillingPayload
}

export const persistMedia = async (url: string): Promise<string> => {
  if (!url) return url
  const result = await requestData<{ url: string }>(appClient, {
    url: '/ai/persist-media',
    method: 'POST',
    data: { url },
  })
  return result.url || url
}

export const imageService = {
  async generate(options: ImageGenerateOptions): Promise<string[]> {
    const historyId = useGenerationHistoryStore.getState().start({
      mediaType: 'image',
      prompt: options.prompt,
      title: titleFromPrompt(options.prompt, '图像生成'),
      source: 'image',
    })
    options.onProgress?.({ status: 'RUNNING' })
    try {
      const resp = await withIdempotentGenerate((idempotencyKey) =>
        requestData<BackendImageResponse & { billing?: BillingPayload }>(appClient, {
          url: '/ai/images/generations',
          method: 'POST',
          signal: options.signal,
          headers: { 'Idempotency-Key': idempotencyKey },
          data: {
            model: options.model,
            prompt: options.prompt,
            n: options.n ?? 1,
            size: options.size ?? '1024x1024',
            quality: options.quality,
            images: options.images,
            negative_prompt: options.negativePrompt,
            projectId: resolveProjectId(),
          },
        })
      )
      applyBillingPayload(resp.billing)
      const urls = (resp.data || []).map((item) => item.url).filter((url): url is string => Boolean(url))
      options.onProgress?.({ status: urls.length ? 'SUCCEEDED' : 'FAILED' })
      if (!urls.length) {
        throw new Error('生成成功但未返回图片')
      }
      useGenerationHistoryStore.getState().succeed(historyId, urls[0])
      return urls
    } catch (error) {
      const message = imageGenerationErrorMessage(error)
      useGenerationHistoryStore.getState().fail(historyId, message)
      if (isCanceledError(error) || (error instanceof Error && error.message === message)) {
        throw error
      }
      throw new Error(message)
    }
  },
}
