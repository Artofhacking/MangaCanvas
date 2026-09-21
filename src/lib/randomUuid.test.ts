import { describe, expect, it } from 'vitest'
import { createRandomUuid } from './randomUuid'

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('createRandomUuid', () => {
  it('prefers crypto.randomUUID when available', () => {
    expect(
      createRandomUuid({
        randomUUID: () => '11111111-1111-4111-8111-111111111111',
      })
    ).toBe('11111111-1111-4111-8111-111111111111')
  })

  it('falls back to getRandomValues UUID v4 when randomUUID is missing', () => {
    const key = createRandomUuid({
      getRandomValues(bytes) {
        for (let i = 0; i < bytes.length; i += 1) bytes[i] = i
        return bytes
      },
    })
    expect(key).toMatch(UUID_V4)
    expect(key).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f')
  })

  it('uses Math.random when Web Crypto is unavailable', () => {
    const key = createRandomUuid(null)
    expect(key).toMatch(UUID_V4)
  })

  it('falls back when randomUUID throws (insecure HTTP context)', () => {
    const key = createRandomUuid({
      randomUUID() {
        throw new TypeError('crypto.randomUUID is not a function')
      },
      getRandomValues(bytes) {
        bytes.fill(0xab)
        return bytes
      },
    })
    expect(key).toMatch(UUID_V4)
    expect(key).toBe('abababab-abab-4bab-abab-abababababab')
  })

  it('falls back when getRandomValues also throws', () => {
    const key = createRandomUuid({
      randomUUID() {
        throw new Error('secure context required')
      },
      getRandomValues() {
        throw new Error('secure context required')
      },
    })
    expect(key).toMatch(UUID_V4)
  })
})
