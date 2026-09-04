/**
 * 图像生成 API
 * POST /api/v1/ai/images/generations
 */

import { appClient } from './clients/appClient'
import { requestData } from './core/response'

// ==================== 类型定义 ====================

/** 支持的图像生成模型 */
export type ImageGenerationModel =
  | 'qwen-image-2.0-pro'
  | 'qwen-image-2.0'
  | 'qwen-image-plus'
  | 'wanx2.1-t2i-plus'
  | 'wanx2.1-t2i-turbo'

/** 输出图像尺寸 */
export type ImageSize =
  | '1024x1024'
  | '720x1280'
  | '1280x720'
  | '1920x1080'
  | '1080x1920'
  | string

/** 响应格式 */
export type ImageResponseFormat = 'url' | 'b64_json'

/** 图像生成请求参数 */
export interface ImageGenerationRequest {
  /** 模型 ID */
  model: ImageGenerationModel
  /** 图像生成提示词 */
  prompt: string
  /** 生成图像数量 (默认: 1) */
  n?: number
  /** 输出图像尺寸 (默认: 1024x1024) */
  size?: ImageSize
  /** 返回格式: url 或 b64_json (默认: url) */
  response_format?: ImageResponseFormat
  /** 图像风格，部分模型支持，如 "<auto>" 自动选择 */
  style?: string
  /** 随机种子，相同种子 + 相同参数可复现相似结果 */
  seed?: number
  /** 反向提示词，描述不希望出现在画面中的元素 */
  negative_prompt?: string
  /** 参考图片 URL，图生图时提供 */
  ref_img?: string
  /** 参考图影响强度，0~1，值越小越接近原图 */
  strength?: number
  /** 用户标识 */
  user?: string
  /** 厂商特有参数透传 */
  vendor_params?: Record<string, unknown>
}

/** 生成的图像数据 */
export interface GeneratedImage {
  /** 图片 URL (response_format 为 url 时返回) */
  url?: string
  /** Base64 编码的图片数据 (response_format 为 b64_json 时返回) */
  b64_json?: string
}

/** 图像生成响应 */
export interface ImageGenerationResponse {
  /** 创建时间戳 */
  created: number
  /** 生成的图像列表 */
  data: GeneratedImage[]
}

// ==================== API 实现 ====================

export const imageGenerationApi = {
  async generate(params: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    return requestData<ImageGenerationResponse>(appClient, {
      url: '/ai/images/generations',
      method: 'POST',
      data: params,
    })
  },

  async quickGenerate(
    prompt: string,
    model: ImageGenerationModel = 'qwen-image-2.0'
  ): Promise<string[]> {
    const response = await this.generate({
      model,
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'url',
    })
    return response.data.map((item) => item.url).filter((url): url is string => !!url)
  },

  async imageToImage(
    prompt: string,
    refImg: string,
    strength = 0.5,
    model: ImageGenerationModel = 'qwen-image-2.0'
  ): Promise<string[]> {
    const response = await this.generate({
      model,
      prompt,
      ref_img: refImg,
      strength,
      n: 1,
      response_format: 'url',
    })
    return response.data.map((item) => item.url).filter((url): url is string => !!url)
  },
}

export const SUPPORTED_IMAGE_MODELS: { value: ImageGenerationModel; label: string }[] = [
  { value: 'qwen-image-2.0-pro', label: 'Qwen Image 2.0 Pro' },
  { value: 'qwen-image-2.0', label: 'Qwen Image 2.0' },
  { value: 'qwen-image-plus', label: 'Qwen Image Plus' },
  { value: 'wanx2.1-t2i-plus', label: 'Wanx 2.1 T2I Plus' },
  { value: 'wanx2.1-t2i-turbo', label: 'Wanx 2.1 T2I Turbo' },
]

export const SUPPORTED_IMAGE_SIZES: { value: ImageSize; label: string }[] = [
  { value: '1024x1024', label: '1024 x 1024 (正方形)' },
  { value: '720x1280', label: '720 x 1280 (竖屏)' },
  { value: '1280x720', label: '1280 x 720 (横屏)' },
  { value: '1920x1080', label: '1920 x 1080 (横屏 HD)' },
  { value: '1080x1920', label: '1080 x 1920 (竖屏 HD)' },
]
