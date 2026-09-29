import { describe, expect, it, vi } from 'vitest'
import { HttpError } from '@/api/core/error'
import { withIdempotentGenerate } from './billing'

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('withIdempotentGenerate', () => {
  it('issues an idempotency key without crypto.randomUUID', async () => {
    vi.stubGlobal('crypto', {
      getRandomValues(bytes: Uint8Array) {
        for (let i = 0; i < bytes.length; i += 1) bytes[i] = (i * 17) & 0xff
        return bytes
      },
    })

    try {
      let seen = ''
      const result = await withIdempotentGenerate(async (key) => {
        seen = key
        return 'ok'
      })
      expect(result).toBe('ok')
      expect(seen).toMatch(UUID_V4)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('does not keep the canvas waiting by retrying a client timeout', async () => {
    let calls = 0
    await expect(
      withIdempotentGenerate(async () => {
        calls += 1
        throw new HttpError('timeout of 600000ms exceeded', {
          code: 'ECONNABORTED',
          url: '/ai/images/generations',
        })
      })
    ).rejects.toThrow(/timeout of 600000ms exceeded/)
    expect(calls).toBe(1)
  })

  it('stops after one anonymous gateway timeout instead of retrying forever', async () => {
    vi.useFakeTimers()
    let calls = 0
    const pending = withIdempotentGenerate(async () => {
      calls += 1
      throw new HttpError('Request failed with status code 504', {
        status: 504,
        url: '/ai/images/generations',
      })
    })
    const assertion = expect(pending).rejects.toThrow(/504/)
    await vi.runAllTimersAsync()
    await assertion
    expect(calls).toBe(2)
    vi.useRealTimers()
  })
})
