import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/clients/appClient', () => ({
  appClient: {},
}))

vi.mock('@/api/core/response', () => ({
  requestData: vi.fn(),
}))

import { requestData } from '@/api/core/response'
import { DETACH_ABORT_REASON, USER_CANCEL_ABORT_REASON } from '@/lib/generationAbort'
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
