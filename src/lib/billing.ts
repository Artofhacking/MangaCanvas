import { HttpError } from '@/api/core/error'
import { createRandomUuid } from '@/lib/randomUuid'
import { applySessionCredits } from '@/lib/session'

export interface BillingPayload {
  charged?: number
  balanceAfter?: number
  uncollected?: boolean
  replayed?: boolean
  reservationId?: number | null
  model?: string
}

export const CREDITS_CHANGE_EVENT = 'mangacanvas-credits-changed'

export function applyBillingPayload(billing?: BillingPayload | null) {
  if (!billing) return
  if (typeof billing.balanceAfter === 'number') {
    applySessionCredits(billing.balanceAfter)
  }
}

export function isPaidGenerateUrl(url?: string) {
  if (!url) return false
  return (
    /\/ai\/images\/generations/.test(url) ||
    /\/ai\/videos\/generations/.test(url) ||
    /\/ai\/audios\/generations/.test(url) ||
    /\/ai\/chat\/completions/.test(url) ||
    /\/scripts\/parse/.test(url)
  )
}

function retryAfterMs() {
  return 1500
}

function isClientTransportTimeout(error: HttpError) {
  const code = String(error.code || '')
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') return true
  return /timeout of \d+ms exceeded/i.test(error.message || '')
}

export function shouldRetrySameIdempotencyKey(error: unknown) {
  if (error instanceof HttpError) {
    if (isClientTransportTimeout(error)) return false
    const code = Number(error.code)
    if (code === 1005 && isPaidGenerateUrl(error.url)) return true
    if (error.status === 504 && (error.code === undefined || Number.isNaN(code))) return true
    if (!error.status && isPaidGenerateUrl(error.url)) return true
    return false
  }
  return false
}

const MAX_LOST_RESPONSE_RETRIES = 1

export async function withIdempotentGenerate<T>(run: (key: string) => Promise<T>): Promise<T> {
  const key = createRandomUuid()
  let lostResponses = 0
  for (;;) {
    try {
      return await run(key)
    } catch (error) {
      if (!shouldRetrySameIdempotencyKey(error)) throw error
      const code = error instanceof HttpError ? Number(error.code) : NaN
      if (code !== 1005) {
        lostResponses += 1
        if (lostResponses > MAX_LOST_RESPONSE_RETRIES) throw error
      }
      await new Promise((resolve) => setTimeout(resolve, retryAfterMs()))
    }
  }
}
