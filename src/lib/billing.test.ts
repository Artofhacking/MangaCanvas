import { describe, expect, it, vi } from 'vitest'
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
})
