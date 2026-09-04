/**
 * 统一图像生成服务
 *
 * 两条链路自动路由：
 *  - wan2.x 系列  → DashScope 直连（异步提交 + 轮询）
 *  - qwen-image / wanx 系列 → 后端代理 /ai/images/generations
 */

import { dashscopeClient } from '@/api/clients/dashscopeClient'
import { requestData } from '@/api/core/response'
import { appClient } from '@/api/clients/appClient'
import { submitAndPoll } from './taskRunner'
import type {
  ImageGenerateOptions,
  DashScopeSubmitResponse,
  DashScopeImageTaskResult,
} from './types'

// ==================== 模型判断 ====================

export const isDashScopeDirectModel = (model: string) => model.startsWith('wan')
export const isI2IModel = (model: string) => model === 'wan2.6-image'

// ==================== 结果提取 ====================

function extractImageUrl(data: DashScopeImageTaskResult): string {
  const choices = data.output?.choices
  if (choices?.length) {
    const hit = choices[0].message?.content?.find(
      (c) => c.type === 'image' && c.image,
    )
    if (hit?.image) return hit.image
  }
  throw new Error('生成成功但未找到图片 URL')
}

// ==================== DashScope 提交 ====================

async function submitT2I(
  prompt: string,
  size: string,
  model: string,
): Promise<string> {
  const { data } = await dashscopeClient.post<DashScopeSubmitResponse>(
    '/services/aigc/image-generation/generation',
    {
      model,
      input: {
        messages: [{ role: 'user', content: [{ text: prompt }] }],
      },
      parameters: {
        prompt_extend: false,
        watermark: false,
        n: 1,
        negative_prompt: '',
        size,
      },
    },
    { headers: { 'X-DashScope-Async': 'enable' } },
  )
  if (!data.output?.task_id) throw new Error('提交任务失败：未返回任务 ID')
  return data.output.task_id
}

async function submitI2I(
  prompt: string,
  images: string[],
  size: string,
  model: string,
): Promise<string> {
  const content: Array<{ text?: string; image?: string }> = []
  if (prompt) content.push({ text: prompt })
  images.forEach((url) => content.push({ image: url }))

  const { data } = await dashscopeClient.post<DashScopeSubmitResponse>(
    '/services/aigc/image-generation/generation',
    {
      model,
      input: {
        messages: [{ role: 'user', content }],
      },
      parameters: {
        prompt_extend: false,
        watermark: false,
        n: 1,
        enable_interleave: false,
        size,
      },
    },
    { headers: { 'X-DashScope-Async': 'enable' } },
  )
  if (!data.output?.task_id) throw new Error('提交任务失败：未返回任务 ID')
  return data.output.task_id
}

// ==================== 后端代理响应 ====================

interface BackendImageResponse {
  created: number
  data: { url?: string; b64_json?: string }[]
}

// ==================== 统一入口 ====================

export const imageService = {
  /**
   * 生成图片（自动路由 DashScope 直连 / 后端代理）
   * @returns 图片 URL 数组
   */
  async generate(options: ImageGenerateOptions): Promise<string[]> {
    const { model } = options

    if (isDashScopeDirectModel(model)) {
      const url = isI2IModel(model)
        ? await this.dashScopeI2I(options)
        : await this.dashScopeT2I(options)
      return [url]
    }

    return this.backendProxy(options)
  },

  /** DashScope 文生图 */
  async dashScopeT2I(options: ImageGenerateOptions): Promise<string> {
    const size = (options.size ?? '1280*1280').replace('x', '*')
    return submitAndPoll<DashScopeImageTaskResult>(
      () => submitT2I(options.prompt, size, options.model),
      extractImageUrl,
      {
        pollInterval: 1000,
        maxAttempts: 120,
        onProgress: options.onProgress,
      },
    )
  },

  /** DashScope 图生图 */
  async dashScopeI2I(options: ImageGenerateOptions): Promise<string> {
    const size = (options.size ?? '1280*1280').replace('x', '*')
    const images = options.images ?? []
    if (!images.length) throw new Error('图生图模式需要提供参考图片')

    return submitAndPoll<DashScopeImageTaskResult>(
      () => submitI2I(options.prompt, images, size, options.model),
      extractImageUrl,
      {
        pollInterval: 1000,
        maxAttempts: 120,
        onProgress: options.onProgress,
      },
    )
  },

  /** 后端代理（qwen-image / wanx 系列） */
  async backendProxy(options: ImageGenerateOptions): Promise<string[]> {
    const resp = await requestData<BackendImageResponse>(appClient, {
      url: '/ai/images/generations',
      method: 'POST',
      data: {
        model: options.model,
        prompt: options.prompt,
        n: options.n ?? 1,
        size: options.size ?? '1024x1024',
        response_format: 'url',
        negative_prompt: options.negativePrompt,
      },
    })
    return resp.data
      .map((item) => item.url)
      .filter((url): url is string => !!url)
  },
}
