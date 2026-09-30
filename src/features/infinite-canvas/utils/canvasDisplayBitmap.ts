/**
 * Card-sized bitmap for an image whose only URL is the original asset.
 * One decode runs at a time, the source bitmap is closed, and the object URL
 * is revoked when the card drops it. Lightbox / download never use this URL.
 */

import { mediaUrl } from '@/lib/mediaUrl'

export const CANVAS_DISPLAY_MAX_EDGE = 256
export const CANVAS_DISPLAY_MAX_SOURCE_BYTES = 12 * 1024 * 1024
export const CANVAS_DISPLAY_DECODE_CONCURRENCY = 1

export function fitDisplayEdge(width: number, height: number, maxEdge = CANVAS_DISPLAY_MAX_EDGE) {
  if (!(width > 0) || !(height > 0) || !(maxEdge > 0)) return { width: 1, height: 1 }
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

const sourceSizes = new Map<string, { width: number; height: number }>()
const sourceSizeListeners = new Set<() => void>()

function sourceSizeKey(url: string): string {
  const trimmed = url.trim()
  return mediaUrl(trimmed) || trimmed
}

/** Original pixel size learned while downscaling a card bitmap. */
export function rememberCanvasSourceSize(url: string, width: number, height: number) {
  if (!url || !(width > 0) || !(height > 0)) return
  const next = { width: Math.round(width), height: Math.round(height) }
  const key = sourceSizeKey(url)
  if (!key) return
  const prev = sourceSizes.get(key)
  if (prev && prev.width === next.width && prev.height === next.height) return
  sourceSizes.set(key, next)
  sourceSizeListeners.forEach((listener) => listener())
}

export function readCanvasSourceSize(url: string): { width: number; height: number } | null {
  if (!url) return null
  return sourceSizes.get(sourceSizeKey(url)) ?? null
}

export function subscribeCanvasSourceSize(listener: () => void) {
  sourceSizeListeners.add(listener)
  return () => {
    sourceSizeListeners.delete(listener)
  }
}

export function revokeCanvasObjectUrl(url: string | null | undefined) {
  if (!url || !url.startsWith('blob:')) return
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url)
  }
}

interface Waiter {
  start: () => void
  reject: (error: Error) => void
}

function abortError() {
  const error = new Error('aborted')
  error.name = 'AbortError'
  return error
}

/** Runs at most `limit` tasks at once. A queued task is dropped when `signal` aborts. */
export function createAsyncLimiter(limit: number) {
  let active = 0
  const waiting: Waiter[] = []

  const pump = () => {
    while (active < limit && waiting.length > 0) {
      const next = waiting.shift()
      if (!next) return
      active += 1
      next.start()
    }
  }

  return function runLimited<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted) {
        reject(abortError())
        return
      }

      let settled = false
      const fail = (error: Error) => {
        if (settled) return
        settled = true
        reject(error)
      }
      const succeed = (value: T) => {
        if (settled) return
        settled = true
        resolve(value)
      }

      const entry: Waiter = { start: () => undefined, reject: fail }
      const onAbort = () => {
        const index = waiting.indexOf(entry)
        if (index >= 0) {
          waiting.splice(index, 1)
          signal?.removeEventListener('abort', onAbort)
          fail(abortError())
        }
      }

      entry.start = () => {
        signal?.removeEventListener('abort', onAbort)
        if (signal?.aborted) {
          active -= 1
          fail(abortError())
          pump()
          return
        }
        Promise.resolve()
          .then(() => task())
          .then(
            (value) => succeed(value),
            (error: unknown) => fail(error instanceof Error ? error : new Error('display decode failed')),
          )
          .finally(() => {
            active -= 1
            pump()
          })
      }

      signal?.addEventListener('abort', onAbort, { once: true })
      waiting.push(entry)
      pump()
    })
  }
}

const runDisplayDecode = createAsyncLimiter(CANVAS_DISPLAY_DECODE_CONCURRENCY)

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('canvas toBlob failed'))
    }, 'image/jpeg', 0.72)
  })
}

/**
 * Fetch one image, scale its longest edge to 256px, and return an object URL.
 * Rejects when the source is too large to decode safely or the request fails.
 */
export async function loadCanvasDisplayObjectUrl(url: string, signal: AbortSignal): Promise<string> {
  return runDisplayDecode(async () => {
    if (signal.aborted) throw abortError()
    if (url.startsWith('data:') && url.length > CANVAS_DISPLAY_MAX_SOURCE_BYTES * 1.4) {
      throw new Error('display image too large')
    }
    const response = await fetch(url, { signal, credentials: 'same-origin' })
    if (!response.ok) throw new Error(`display image ${response.status}`)
    const blob = await response.blob()
    if (blob.size > CANVAS_DISPLAY_MAX_SOURCE_BYTES) throw new Error('display image too large')
    if (signal.aborted) throw abortError()
    const source = await createImageBitmap(blob)
    try {
      rememberCanvasSourceSize(url, source.width, source.height)
      const edge = fitDisplayEdge(source.width, source.height)
      const canvas = document.createElement('canvas')
      canvas.width = edge.width
      canvas.height = edge.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('no canvas context')
      context.drawImage(source, 0, 0, edge.width, edge.height)
      const encoded = await canvasToJpegBlob(canvas)
      if (signal.aborted) throw abortError()
      return URL.createObjectURL(encoded)
    } finally {
      source.close()
    }
  }, signal)
}
