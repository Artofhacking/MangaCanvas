import { HttpError } from '@/api/core/error'
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
    /\/ai\/chat\/completions/.test(url) ||
    /\/scripts\/parse/.test(url)
  )
}

function retryAfterMs() {
  return 1500
}

export function shouldRetrySameIdempotencyKey(error: unknown) {
  if (error instanceof HttpError) {
    const code = Number(error.code)
    if (code === 1005 && isPaidGenerateUrl(error.url)) return true
    if (error.status === 504 && (error.code === undefined || Number.isNaN(code))) return true
    if (!error.status && isPaidGenerateUrl(error.url)) return true
    return false
  }
  return false
}

export async function withIdempotentGenerate<T>(run: (key: string) => Promise<T>): Promise<T> {
  const key = crypto.randomUUID()
  for (;;) {
    try {
      return await run(key)
    } catch (error) {
      if (!shouldRetrySameIdempotencyKey(error)) throw error
      await new Promise((resolve) => setTimeout(resolve, retryAfterMs()))
    }
  }
}
