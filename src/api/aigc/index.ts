/**
 * AIGC 服务层统一出口
 *
 * 使用示例：
 *
 *   import { imageService, videoService, chatService } from '@/api/aigc'
 *
 *   // 生成图片
 *   const urls = await imageService.generate({ model: 'wan2.6-t2i', prompt: '...' })
 *
 *   // 生成视频
 *   const videoUrl = await videoService.generate({ model: 'wan2.6-i2v-flash', prompt: '...' })
 *
 *   // 聊天
 *   const answer = await chatService.complete({ model: 'qwen-plus', messages: [...] })
 */

export * from './types'
export * from './taskRunner'
export { imageService, isDashScopeDirectModel, isI2IModel } from './imageService'
export { videoService, isT2VModel, isI2VModel, isKF2VModel, isVideoModel } from './videoService'
export { chatService } from './chatService'
