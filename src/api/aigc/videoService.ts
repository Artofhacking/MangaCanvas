import { appClient } from '@/api/clients/appClient'
import { HttpError, isCanceledError } from '@/api/core'
import { requestData } from '@/api/core/response'
import { applyBillingPayload, withIdempotentGenerate, type BillingPayload } from '@/lib/billing'
import { isUserCancelAbort } from '@/lib/generationAbort'
import { resolveProjectId } from '@/lib/session'
import { formatAiError } from '@/lib/formatAiError'
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

const SUBMIT_TIMEOUT_MS = 30_000
const STATUS_TIMEOUT_MS = 15_000
const POLL_INTERVAL_MS = 3_000
/** 20 min of polls covers a queued job plus the upstream video wait. */
const MAX_POLLS = 400

type VideoJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export interface VideoJobView {
  job_id: string
  status: VideoJobStatus
  progress?: number | null
  message?: string | null
  url?: string
  billing?: BillingPayload
}

type VideoJob = VideoJobView

export interface VideoWatchOptions {
  signal?: AbortSignal
  onProgress?: VideoGenerateOptions['onProgress']
}

function abortedError() {
  const error = new Error('已取消')
  error.name = 'AbortError'
  return error
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortedError()
}

function isSubmitTimeout(error: unknown) {
  if (!(error instanceof HttpError)) return false
  const code = String(error.code || '')
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') return true
  return /timeout of \d+ms exceeded/i.test(error.message || '')
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortedError())
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(abortedError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function postJob(options: VideoGenerateOptions, idempotencyKey: string) {
  return requestData<VideoJob>(appClient, {
    url: '/ai/videos/generations',
    method: 'POST',
    timeout: SUBMIT_TIMEOUT_MS,
    signal: options.signal,
    headers: { 'Idempotency-Key': idempotencyKey },
    data: {
      model: options.model,
      prompt: options.prompt,
      firstFrameImage: options.firstFrameImage || options.images?.[0],
      lastFrameImage: options.lastFrameImage,
      images: options.images,
      imageNames: options.imageNames,
      size: options.size,
      resolution: options.resolution,
      ...(options.ratio ? { ratio: options.ratio } : {}),
      duration: options.duration,
      template: options.template,
      nodeId: options.nodeId,
      ...(options.batchId ? { batchId: options.batchId } : {}),
      projectId: resolveProjectId(),
    },
  })
}

async function submitJob(options: VideoGenerateOptions, idempotencyKey: string) {
  try {
    return await postJob(options, idempotencyKey)
  } catch (error) {
    if (!isSubmitTimeout(error) || options.signal?.aborted) throw error
    return postJob(options, idempotencyKey)
  }
}

function cancelJob(jobId: string) {
  void requestData(appClient, {
    url: `/ai/videos/generations/${jobId}/cancel`,
    method: 'POST',
    timeout: STATUS_TIMEOUT_MS,
  }).catch(() => undefined)
}

async function readJob(jobId: string, signal?: AbortSignal) {
  return requestData<VideoJob>(appClient, {
    url: `/ai/videos/generations/${jobId}`,
    method: 'GET',
    timeout: STATUS_TIMEOUT_MS,
    signal,
  })
}

async function watchJob(jobId: string, options: VideoWatchOptions = {}): Promise<VideoJob> {
  let transportErrors = 0
  for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
    throwIfAborted(options.signal)
    let job: VideoJob
    try {
      job = await readJob(jobId, options.signal)
      transportErrors = 0
    } catch (error) {
      if (options.signal?.aborted || isCanceledError(error)) throw abortedError()
      transportErrors += 1
      if (transportErrors >= 5) throw error
      await sleep(POLL_INTERVAL_MS, options.signal)
      continue
    }

    if (job.status === 'queued') {
      options.onProgress?.({ status: 'PENDING', taskId: job.job_id })
    } else if (job.status === 'running') {
      const percent = typeof job.progress === 'number' ? job.progress : undefined
      options.onProgress?.({ status: 'RUNNING', taskId: job.job_id, percent })
    } else if (job.status === 'succeeded') {
      applyBillingPayload(job.billing)
      options.onProgress?.({ status: 'SUCCEEDED', taskId: job.job_id })
      return job
    } else if (job.status === 'cancelled') {
      applyBillingPayload(job.billing)
      return job
    } else {
      applyBillingPayload(job.billing)
      options.onProgress?.({ status: 'FAILED', taskId: job.job_id })
      return job
    }

    await sleep(POLL_INTERVAL_MS, options.signal)
  }
  throw new Error('视频生成超时，请稍后重试')
}

async function pollJob(jobId: string, options: VideoGenerateOptions) {
  const job = await watchJob(jobId, options)
  if (job.status === 'succeeded') {
    if (!job.url) throw new Error(formatAiError(job.message || '', '生成成功但未找到视频 URL'))
    return job.url
  }
  if (job.status === 'cancelled') throw abortedError()
  throw new Error(formatAiError(job.message || '', '视频生成失败'))
}

export const videoService = {
  async generate(options: VideoGenerateOptions): Promise<string> {
    const historyId = useGenerationHistoryStore.getState().start({
      mediaType: 'video',
      prompt: options.prompt,
      title: titleFromPrompt(options.prompt, '视频生成'),
      source: 'video',
    })
    options.onProgress?.({ status: 'PENDING' })
    let jobId = ''
    // Refresh and workflow changes abort the local signal only. The cancel API
    // runs when the user pressed 取消 (`reason === 'user'`).
    const onAbort = () => {
      if (jobId && isUserCancelAbort(options.signal)) cancelJob(jobId)
    }
    options.signal?.addEventListener('abort', onAbort)
    try {
      const submitted = await withIdempotentGenerate((idempotencyKey) => submitJob(options, idempotencyKey))
      jobId = submitted.job_id
      applyBillingPayload(submitted.billing)
      if (jobId) options.onSubmitted?.(jobId)
      if (isUserCancelAbort(options.signal)) {
        if (jobId) cancelJob(jobId)
        throw abortedError()
      }
      if (options.signal?.aborted) throw abortedError()
      if (!jobId) throw new Error('视频任务未返回 job_id')
      if (submitted.status === 'succeeded' && submitted.url) {
        options.onProgress?.({ status: 'SUCCEEDED', taskId: jobId })
        useGenerationHistoryStore.getState().succeed(historyId, submitted.url)
        return submitted.url
      }
      if (submitted.status === 'failed') {
        throw new Error(formatAiError(submitted.message || '', '视频生成失败'))
      }
      if (submitted.status === 'cancelled') throw abortedError()
      const url = await pollJob(jobId, options)
      useGenerationHistoryStore.getState().succeed(historyId, url)
      return url
    } catch (error) {
      const canceled = isCanceledError(error) || (error instanceof Error && error.name === 'AbortError')
      const message = canceled ? '已取消' : formatAiError(error, '生成失败')
      useGenerationHistoryStore.getState().fail(historyId, message)
      throw error
    } finally {
      options.signal?.removeEventListener('abort', onAbort)
    }
  },

  cancel(jobId: string) {
    if (jobId) cancelJob(jobId)
  },

  watch(jobId: string, options?: VideoWatchOptions) {
    return watchJob(jobId, options)
  },
}
