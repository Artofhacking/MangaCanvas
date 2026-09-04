import { appClient } from '@/api/clients/appClient'
import { requestData } from '@/api/core/response'
import type { VideoGenerateOptions } from './types'

export const isT2VModel = (model: string) => model.startsWith('wan') && model.includes('t2v')
export const isI2VModel = (model: string) => model.startsWith('wan') && model.includes('i2v')
export const isKF2VModel = (model: string) => model.startsWith('wan') && model.includes('kf2v')
export const isVideoModel = (model: string) => isT2VModel(model) || isI2VModel(model) || isKF2VModel(model)

export const videoService = {
  async generate(options: VideoGenerateOptions): Promise<string> {
    options.onProgress?.({ status: 'RUNNING' })
    const result = await requestData<{ url: string }>(appClient, {
      url: '/ai/videos/generations',
      method: 'POST',
      data: {
        model: options.model,
        prompt: options.prompt,
        firstFrameImage: options.firstFrameImage,
        lastFrameImage: options.lastFrameImage,
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
    return result.url
  },
}
