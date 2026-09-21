type CryptoLike = {
  randomUUID?: () => string
  getRandomValues?: (array: Uint8Array) => Uint8Array
}

function bytesToUuidV4(bytes: Uint8Array) {
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function uuidFromMathRandom() {
  const bytes = new Uint8Array(16)
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256)
  }
  return bytesToUuidV4(bytes)
}

/**
 * UUID v4 for idempotency keys.
 * `crypto.randomUUID` is secure-context-only; HTTP deploys need fallbacks.
 */
export function createRandomUuid(cryptoApi: CryptoLike | null | undefined = globalThis.crypto): string {
  try {
    const native = cryptoApi?.randomUUID?.()
    if (typeof native === 'string' && native) return native
  } catch {
    // insecure context or incomplete Web Crypto
  }

  if (typeof cryptoApi?.getRandomValues === 'function') {
    try {
      const bytes = new Uint8Array(16)
      cryptoApi.getRandomValues(bytes)
      return bytesToUuidV4(bytes)
    } catch {
      // getRandomValues can also throw outside a secure context
    }
  }

  return uuidFromMathRandom()
}
