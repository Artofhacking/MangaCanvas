/**
 * AIGC 服务层统一类型定义
 */

// ==================== 任务状态 ====================

export type TaskStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN'

export interface TaskProgress {
  status: TaskStatus
  taskId?: string
}

// ==================== 图像生成 ====================

export interface ImageGenerateOptions {
  model: string
  prompt: string
  size?: string
  quality?: string
  /** 参考图片 URL 列表（图生图模式） */
  images?: string[]
  n?: number
  negativePrompt?: string
  onProgress?: (progress: TaskProgress) => void
}

// ==================== 视频生成 ====================

export interface VideoGenerateOptions {
  model: string
  prompt: string
  firstFrameImage?: string
  lastFrameImage?: string
  size?: string
  resolution?: string
  duration?: number
  /** 视频特效模板 ID */
  template?: string
  onProgress?: (progress: TaskProgress) => void
}

// ==================== 聊天 ====================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  model: string
  messages: ChatMessage[]
}

// ==================== DashScope 响应格式 ====================

export interface DashScopeSubmitResponse {
  output: {
    task_status: TaskStatus
    task_id: string
  }
  request_id: string
}

export interface DashScopeImageTaskResult {
  request_id: string
  output: {
    task_id: string
    task_status: TaskStatus
    submit_time?: string
    scheduled_time?: string
    end_time?: string
    choices?: {
      finish_reason: string
      message: {
        role: string
        content: { image?: string; type?: string }[]
      }
    }[]
    code?: string
    message?: string
  }
  usage?: Record<string, unknown>
}

export interface DashScopeVideoTaskResult {
  request_id: string
  output: {
    task_id: string
    task_status: TaskStatus
    submit_time?: string
    scheduled_time?: string
    end_time?: string
    video_url?: string
    code?: string
    message?: string
  }
  usage?: Record<string, unknown>
}
