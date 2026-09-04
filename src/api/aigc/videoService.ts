/**
 * 统一视频生成服务
 *
 * 支持五种模式，全部走 DashScope 直连：
 *  - 文生视频 (T2V)
 *  - 图生视频 (I2V)
 *  - 关键帧生视频 (KF2V)
 *  - 视频特效 (Template Effect)
 */

import { dashscopeClient } from '@/api'
import { submitAndPoll } from './taskRunner'
import type {
  VideoGenerateOptions,
  DashScopeSubmitResponse,
  DashScopeVideoTaskResult,
} from './types'

// ==================== 模型判断 ====================

export const isT2VModel = (model: string) =>
  model.startsWith('wan') && model.includes('t2v')

export const isI2VModel = (model: string) =>
  model.startsWith('wan') && model.includes('i2v')

export const isKF2VModel = (model: string) =>
  model.startsWith('wan') && model.includes('kf2v')

export const isVideoModel = (model: string) =>
  isT2VModel(model) || isI2VModel(model) || isKF2VModel(model)

// ==================== 结果提取 ====================

function extractVideoUrl(data: DashScopeVideoTaskResult): string {
  const url = data.output?.video_url
  if (url) return url
  throw new Error('生成成功但未找到视频 URL')
}

// ==================== 通用提交 ====================

async function submitVideoTask(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<string> {
  const { data } = await dashscopeClient.post<DashScopeSubmitResponse>(
    endpoint,
    body,
    { headers: { 'X-DashScope-Async': 'enable' } },
  )
  if (!data.output?.task_id) throw new Error('提交任务失败：未返回任务 ID')
  return data.output.task_id
}

// ==================== 各模式提交函数 ====================

function submitT2V(prompt: string, size: string, duration: number, model: string) {
  return submitVideoTask('/services/aigc/video-generation/video-synthesis', {
    model,
    input: { prompt },
    parameters: { size, prompt_extend: true, duration, shot_type: 'multi' },
  })
}

function submitI2V(
  prompt: string,
  imageUrl: string,
  resolution: string,
  duration: number,
  model: string,
) {
  return submitVideoTask('/services/aigc/video-generation/video-synthesis', {
    model,
    input: { prompt, img_url: imageUrl },
    parameters: { resolution, prompt_extend: false, duration, shot_type: 'multi' },
  })
}

function submitKF2V(
  prompt: string,
  firstFrameUrl: string,
  lastFrameUrl: string,
  resolution: string,
  model: string,
) {
  return submitVideoTask('/services/aigc/image2video/video-synthesis', {
    model,
    input: { first_frame_url: firstFrameUrl, last_frame_url: lastFrameUrl, prompt },
    parameters: { resolution, prompt_extend: false },
  })
}

function submitTemplateEffect(
  imageUrl: string,
  template: string,
  resolution: string,
  model: string,
) {
  return submitVideoTask('/services/aigc/video-generation/video-synthesis', {
    model,
    input: { img_url: imageUrl, template },
    parameters: { resolution },
  })
}

// ==================== 统一入口 ====================

export const videoService = {
  /**
   * 生成视频（自动路由到对应模式）
   * @returns 视频 URL
   */
  async generate(options: VideoGenerateOptions): Promise<string> {
    const {
      model,
      prompt,
      firstFrameImage,
      lastFrameImage,
      size = '1280*720',
      resolution = '720P',
      duration = 5,
      template,
      onProgress,
    } = options

    const pollOpts = {
      pollInterval: 5000,
      maxAttempts: 180,
      onProgress,
    }

    // 视频特效模式
    if (template && firstFrameImage) {
      return submitAndPoll<DashScopeVideoTaskResult>(
        () => submitTemplateEffect(firstFrameImage, template, resolution, model),
        extractVideoUrl,
        pollOpts,
      )
    }

    // 文生视频
    if (isT2VModel(model)) {
      return submitAndPoll<DashScopeVideoTaskResult>(
        () => submitT2V(prompt, size, duration, model),
        extractVideoUrl,
        pollOpts,
      )
    }

    // 关键帧生视频
    if (isKF2VModel(model)) {
      return submitAndPoll<DashScopeVideoTaskResult>(
        () => submitKF2V(prompt, firstFrameImage ?? '', lastFrameImage ?? '', resolution, model),
        extractVideoUrl,
        pollOpts,
      )
    }

    // 图生视频
    if (isI2VModel(model)) {
      return submitAndPoll<DashScopeVideoTaskResult>(
        () => submitI2V(prompt, firstFrameImage ?? '', resolution, duration, model),
        extractVideoUrl,
        pollOpts,
      )
    }

    throw new Error(`不支持的视频模型: ${model}`)
  },
}
