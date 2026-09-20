import { appClient } from '@/api/clients/appClient'
import { requestData } from '@/api/core/response'
import { titleFromPrompt, useGenerationHistoryStore } from '@/store/generationHistoryStore'
import type { VideoGenerateOptions } from './types'

export const isSeedanceModel = (model: string) => /seedance/i.test(model)
export const isMiniMaxModel = (model: string) => /minimax|hailuo/i.test(model)
export const isViduModel = (model: string) => /vidu/i.test(model)
export const isT2VModel = (model: string) =>
  model.includes('t2v') || isSeedanceModel(model) || isMiniMaxModel(model) || isViduModel(model)
export const isI2VModel = (model: string) => model.includes('i2v')
export const isKF2VModel = (model: string) => model.includes('kf2v')
export const isVideoModel = (model: string) => isT2VModel(model) || isI2VModel(model) || isKF2VModel(model)

export const videoService = {
  async generate(options: VideoGenerateOptions): Promise<string> {
    const historyId = useGenerationHistoryStore.getState().start({
      mediaType: 'video',
      prompt: options.prompt,
      title: titleFromPrompt(options.prompt, '视频生成'),
      source: 'video',
    })
    options.onProgress?.({ status: 'RUNNING' })
    try {
      const result = await requestData<{ url: string }>(appClient, {
        url: '/ai/videos/generations',
        method: 'POST',
        timeout: 600000,
        data: {
          model: options.model,
          prompt: options.prompt,
          firstFrameImage: options.firstFrameImage || options.images?.[0],
          lastFrameImage: options.lastFrameImage,
          images: options.images,
          imageNames: options.imageNames,
          size: options.size,
          resolution: options.resolution,
          duration: options.duration,
          template: options.template,
        },
      })
      if (!result.url) {
        options.onProgress?.({ status: 'FAILED' })
        throw new Error('生成成功但未找到视频 URL')
      }
      options.onProgress?.({ status: 'SUCCEEDED' })
      useGenerationHistoryStore.getState().succeed(historyId, result.url)
      return result.url
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成失败'
      useGenerationHistoryStore.getState().fail(historyId, message)
      throw error
    }
  },
}
