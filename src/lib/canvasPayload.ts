const INLINE_MEDIA = /^data:(?:image|video|audio)\//i
const BLOB_URL = /^blob:/i

export interface CanvasGraph {
  nodes: unknown[]
  edges: unknown[]
  viewport: { x: number; y: number; zoom: number }
}

export function isInlineCanvasMedia(value: unknown): value is string {
  return typeof value === 'string' && (INLINE_MEDIA.test(value) || BLOB_URL.test(value))
}

export function graphHasInlineMedia(value: unknown): boolean {
  if (isInlineCanvasMedia(value)) return true
  if (Array.isArray(value)) return value.some((item) => graphHasInlineMedia(item))
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) => graphHasInlineMedia(item))
  }
  return false
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16)
}

function signatureValue(value: unknown): unknown {
  if (typeof value === 'string') {
    if (isInlineCanvasMedia(value)) return `inline:${value.length}:${fnv1a(value)}`
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) return value
  if (Array.isArray(value)) return value.map((item) => signatureValue(item))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (typeof child === 'function') continue
      out[key] = signatureValue(child)
    }
    return out
  }
  return null
}

/** Stable fingerprint that does not embed data-URL bytes. */
export function canvasSignature(graph: CanvasGraph): string {
  return JSON.stringify(signatureValue(graph))
}

export function applyInlineReplacements<T>(value: T, replacements: ReadonlyMap<string, string>): T {
  if (replacements.size === 0) return value

  const walk = (item: unknown): unknown => {
    if (typeof item === 'string') return replacements.get(item) ?? item
    if (Array.isArray(item)) return item.map((child) => walk(child))
    if (!item || typeof item !== 'object') return item
    const record = item as Record<string, unknown>
    const next: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(record)) {
      next[key] = walk(child)
    }
    const url = next.url
    const encoded = next.base64
    if (typeof encoded === 'string' && (encoded === '' || encoded === url)) {
      delete next.base64
    } else if (typeof encoded === 'string' && encoded.startsWith('/static/') && !url) {
      next.url = encoded
      delete next.base64
    }
    return next
  }

  return walk(value) as T
}

export async function collectInlineReplacements(
  value: unknown,
  upload: (inline: string) => Promise<string>,
): Promise<Map<string, string>> {
  const replacements = new Map<string, string>()

  const visit = async (item: unknown): Promise<void> => {
    if (typeof item === 'string') {
      if (!isInlineCanvasMedia(item) || replacements.has(item)) return
      const stored = await upload(item)
      if (!stored || isInlineCanvasMedia(stored)) {
        throw new Error('图片未能保存为文件地址')
      }
      replacements.set(item, stored)
      return
    }
    if (Array.isArray(item)) {
      for (const child of item) await visit(child)
      return
    }
    if (item && typeof item === 'object') {
      for (const child of Object.values(item as Record<string, unknown>)) await visit(child)
    }
  }

  await visit(value)
  return replacements
}
