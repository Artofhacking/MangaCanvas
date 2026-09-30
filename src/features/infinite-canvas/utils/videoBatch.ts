import { isCanceledError } from '@/api/core'

export interface VideoBatchResult {
  urls: string[]
  rateLimited: boolean
  errorMessage?: string
}

function abortError() {
  const error = new Error('已取消')
  error.name = 'AbortError'
  return error
}

function isAbort(error: unknown): boolean {
  return isCanceledError(error) || (error instanceof Error && error.name === 'AbortError')
}

function isRateLimit(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.message === 'API_RATE_LIMIT' || error.message.includes('429')
}

/**
 * Run N video jobs together and keep successes in request order.
 * A cancel aborts the whole batch. One clip failing does not drop the others.
 */
export async function collectVideoBatch(input: {
  count: number
  signal?: AbortSignal
  run: (index: number) => Promise<string | null>
  onProgress?: (finished: number, total: number) => void
}): Promise<VideoBatchResult> {
  const total = Number.isFinite(input.count) ? Math.max(0, Math.floor(input.count)) : 0
  if (input.signal?.aborted) throw abortError()
  if (total === 0) return { urls: [], rateLimited: false }

  const slots: Array<string | null> = Array.from({ length: total }, () => null)
  let finished = 0
  let rateLimited = false
  let errorMessage = ''

  await Promise.all(slots.map(async (_, index) => {
    try {
      if (input.signal?.aborted) throw abortError()
      const url = await input.run(index)
      const clean = typeof url === 'string' ? url.trim() : ''
      slots[index] = clean || null
    } catch (error) {
      if (input.signal?.aborted || isAbort(error)) throw error
      if (isRateLimit(error)) rateLimited = true
      else if (error instanceof Error && error.message) errorMessage = error.message
      slots[index] = null
    } finally {
      finished += 1
      input.onProgress?.(finished, total)
    }
  }))

  return {
    urls: slots.filter((item): item is string => Boolean(item)),
    rateLimited,
    errorMessage: errorMessage || undefined,
  }
}
