import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/clients/appClient', () => ({
  appClient: {},
}))

vi.mock('@/api/core/response', () => ({
  requestData: vi.fn(),
}))

import { requestData } from '@/api/core/response'
import { DETACH_ABORT_REASON, USER_CANCEL_ABORT_REASON } from '@/lib/generationAbort'
import { FIRST_FRAME_RATIO_HINT } from '@/lib/formatAiError'
import { useGenerationHistoryStore } from '@/store/generationHistoryStore'
import { videoService } from './videoService'

const request = vi.mocked(requestData)

function isCancel(url: string) {
  return url.endsWith('/cancel')
}

describe('videoService refresh does not cancel the backend job', () => {
  beforeEach(() => {
    request.mockReset()
  })

  it('calls onSubmitted and only cancels when the abort reason is the user', async () => {
    const submitted: string[] = []
    request.mockImplementation(async (_client, config) => {
      const url = String(config?.url || '')
      if (config?.method === 'POST' && url === '/ai/videos/generations') {
        return { job_id: 'job_1', status: 'queued' }
      }
      if (config?.method === 'GET') {
        return { job_id: 'job_1', status: 'succeeded', url: 'https://cdn.example/a.mp4' }
      }
      if (isCancel(url)) return { job_id: 'job_1', status: 'cancelled' }
      throw new Error(`unexpected ${config?.method} ${url}`)
    })

    const url = await videoService.generate({
      model: 'happyhorse-1.1-t2v',
      prompt: '雨夜',
      onSubmitted: (jobId) => submitted.push(jobId),
    })

    expect(url).toBe('https://cdn.example/a.mp4')
    expect(submitted).toEqual(['job_1'])
    expect(request.mock.calls.some((call) => isCancel(String(call[1]?.url || '')))).toBe(false)
  })

  it('does not cancel when the local poller is detached', async () => {
    const controller = new AbortController()
    request.mockImplementation(async (_client, config) => {
      const url = String(config?.url || '')
      if (config?.method === 'POST' && url === '/ai/videos/generations') {
        return { job_id: 'job_1', status: 'queued' }
      }
      if (config?.method === 'GET') {
        controller.abort(DETACH_ABORT_REASON)
        return { job_id: 'job_1', status: 'queued' }
      }
      if (isCancel(url)) return { job_id: 'job_1', status: 'cancelled' }
      throw new Error(`unexpected ${config?.method} ${url}`)
    })

    await expect(videoService.generate({
      model: 'happyhorse-1.1-t2v',
      prompt: '雨夜',
      signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' })

    expect(request.mock.calls.some((call) => isCancel(String(call[1]?.url || '')))).toBe(false)
  })

  it('cancels the submitted job when the user aborts', async () => {
    const controller = new AbortController()
    request.mockImplementation(async (_client, config) => {
      const url = String(config?.url || '')
      if (config?.method === 'POST' && url === '/ai/videos/generations') {
        return { job_id: 'job_1', status: 'queued' }
      }
      if (config?.method === 'GET') {
        controller.abort(USER_CANCEL_ABORT_REASON)
        return { job_id: 'job_1', status: 'running', progress: 10 }
      }
      if (isCancel(url)) return { job_id: 'job_1', status: 'cancelled' }
      throw new Error(`unexpected ${config?.method} ${url}`)
    })

    await expect(videoService.generate({
      model: 'happyhorse-1.1-t2v',
      prompt: '雨夜',
      signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' })

    expect(request.mock.calls.filter((call) => isCancel(String(call[1]?.url || ''))).length).toBeGreaterThan(0)
  })
})

describe('videoService failure copy', () => {
  beforeEach(() => {
    request.mockReset()
  })

  it('rejects with a Chinese hint instead of the upstream JSON body', async () => {
    const upstream = '视频任务提交失败: {"error":{"code":"InvalidParameter.TaskTypeConstraint","message":"The parameter ratio specified in the request is not valid. For first-frame or first-last-frame generation, the output ratio follows the first-frame image.","type":"BadRequest"},"content":[{"text":"输入图片说明：雾峡"}]}'
    request.mockImplementation(async (_client, config) => {
      const url = String(config?.url || '')
      if (config?.method === 'POST' && url === '/ai/videos/generations') {
        return { job_id: 'job_fail', status: 'failed', message: upstream }
      }
      throw new Error(`unexpected ${config?.method} ${url}`)
    })

    await expect(videoService.generate({
      model: 'doubao-seedance-2-0-260128',
      prompt: '雾峡失败样本',
    })).rejects.toThrow(FIRST_FRAME_RATIO_HINT)

    const item = useGenerationHistoryStore.getState().items.find((entry) => entry.prompt === '雾峡失败样本')
    expect(item?.status).toBe('failed')
    expect(item?.error).toContain(FIRST_FRAME_RATIO_HINT)
    expect(item?.error).not.toContain('{')
    expect(item?.error).not.toContain('雾峡')
  })
})
