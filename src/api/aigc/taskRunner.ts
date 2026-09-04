/**
 * DashScope 异步任务引擎
 *
 * 所有 AIGC 生成任务共用的 "提交 → 轮询 → 提取结果" 流程。
 * imageService / videoService 只需提供各自的 submit 函数和 result 提取器。
 */

import { dashscopeClient, translateDashScopeErrorMessage } from '@/api'
import type { TaskStatus, TaskProgress } from './types'

interface DashScopeTaskResponse {
  output: {
    task_id: string
    task_status: TaskStatus
    message?: string
  }
}

export interface PollOptions {
  /** 轮询间隔（ms），默认 2000 */
  pollInterval?: number
  /** 最大轮询次数，默认 180 */
  maxAttempts?: number
  onProgress?: (progress: TaskProgress) => void
}

/**
 * 轮询 DashScope 异步任务直到完成
 */
export async function pollDashScopeTask<T extends DashScopeTaskResponse>(
  taskId: string,
  extractResult: (data: T) => string,
  options?: PollOptions,
): Promise<string> {
  const {
    pollInterval = 2000,
    maxAttempts = 180,
    onProgress,
  } = options ?? {}

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await dashscopeClient.get<T>(`/tasks/${taskId}`)
    const data = response.data
    const status: TaskStatus = data.output?.task_status ?? 'UNKNOWN'

    onProgress?.({ status, taskId })

    if (status === 'SUCCEEDED') {
      return extractResult(data)
    }

    if (status === 'FAILED') {
      const raw = data.output?.message || '任务失败'
      throw new Error(translateDashScopeErrorMessage(raw))
    }

    await new Promise((r) => setTimeout(r, pollInterval))
  }

  throw new Error('任务超时，请稍后重试')
}

/**
 * 提交 DashScope 异步任务并轮询到完成
 *
 * @param submitFn  执行提交、返回 taskId
 * @param extractResult  从轮询响应中提取最终结果（URL 等）
 * @param options  轮询配置
 */
export async function submitAndPoll<T extends DashScopeTaskResponse>(
  submitFn: () => Promise<string>,
  extractResult: (data: T) => string,
  options?: PollOptions,
): Promise<string> {
  const taskId = await submitFn()
  options?.onProgress?.({ status: 'PENDING', taskId })
  return pollDashScopeTask<T>(taskId, extractResult, options)
}
