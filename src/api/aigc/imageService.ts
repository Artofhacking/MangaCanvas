import { appClient } from '@/api/clients/appClient'
import { requestData } from '@/api/core/response'
import type { ImageGenerateOptions } from './types'

export const isDashScopeDirectModel = (model: string) => model.startsWith('wan')
export const isI2IModel = (model: string) => model === 'wan2.6-image'

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
    options.onProgress?.({ status: 'RUNNING' })
    const resp = await requestData<BackendImageResponse>(appClient, {
      url: '/ai/images/generations',
      method: 'POST',
      data: {
        model: options.model,
        prompt: options.prompt,
        n: options.n ?? 1,
        size: options.size ?? '1024x1024',
        images: options.images,
        negative_prompt: options.negativePrompt,
      },
    })
    const urls = (resp.data || []).map((item) => item.url).filter((url): url is string => Boolean(url))
    options.onProgress?.({ status: urls.length ? 'SUCCEEDED' : 'FAILED' })
    if (!urls.length) {
      throw new Error('生成成功但未返回图片')
    }
    return urls
  },
}
