import { appClient } from '@/api/clients/appClient'
import { requestData } from '@/api/core/response'
import { titleFromPrompt, useGenerationHistoryStore } from '@/store/generationHistoryStore'
import type { ImageGenerateOptions } from './types'

export const isDashScopeDirectModel = (model: string) => model.startsWith('wan')

/** Models whose /ai/images/generations path actually consumes `images`. */
export const isI2IModel = (model: string) =>
  model === 'wan2.6-image' || model.startsWith('gpt-image')

export const UNSUPPORTED_REFERENCE_IMAGE_MESSAGE =
  '当前模型不支持参考图，请改用万相 2.6 图生图'

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
    const resp = await requestData<BackendImageResponse>(appClient, {
      url: '/ai/images/generations',
      method: 'POST',
      signal: options.signal,
      data: {
          model: options.model,
          prompt: options.prompt,
          n: options.n ?? 1,
          size: options.size ?? '1024x1024',
          quality: options.quality,
          images: options.images,
          negative_prompt: options.negativePrompt,
        },
      })
      const urls = (resp.data || []).map((item) => item.url).filter((url): url is string => Boolean(url))
      options.onProgress?.({ status: urls.length ? 'SUCCEEDED' : 'FAILED' })
      if (!urls.length) {
        throw new Error('生成成功但未返回图片')
      }
      useGenerationHistoryStore.getState().succeed(historyId, urls[0])
      return urls
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成失败'
      useGenerationHistoryStore.getState().fail(historyId, message)
      throw error
    }
  },
}
