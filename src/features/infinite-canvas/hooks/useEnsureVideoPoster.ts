import { useEffect } from 'react'
import { isInlineCanvasMedia } from '@/lib/canvasPayload'
import { uploadCanvasBlob } from '@/lib/uploadCanvasMedia'
import { useCanvasNodeInViewport } from './useCanvasNodeInViewport'
import { useCanvasStore } from '../stores/canvasStore'
import { createAsyncLimiter } from '../utils/canvasDisplayBitmap'
import { CANVAS_VIDEO_MIN_VISIBLE_RATIO } from '../utils/canvasMediaBudget'
import { mediaPixelPatch, readExplicitMediaPixels } from '../utils/mediaFrame'
import {
  canvasVideoCaptureSrc,
  captureVideoPosterBlob,
  preferredVideoPoster,
  videoPosterSeekTime,
} from '../utils/videoPoster'
import { readVideoStack } from '../utils/videoStack'

const runVideoPosterJob = createAsyncLimiter(1)

function abortError() {
  const error = new Error('aborted')
  error.name = 'AbortError'
  return error
}

function releaseVideo(video: HTMLVideoElement | null) {
  if (!video) return
  video.pause()
  video.removeAttribute('src')
  try {
    video.load()
  } catch {
    // The element is already detached.
  }
}

function waitForVideoEvent(video: HTMLVideoElement, eventName: string, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError())
      return
    }
    const cleanup = () => {
      video.removeEventListener(eventName, onEvent)
      video.removeEventListener('error', onError)
      signal.removeEventListener('abort', onAbort)
    }
    const onEvent = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('视频加载失败'))
    }
    const onAbort = () => {
      cleanup()
      reject(abortError())
    }
    video.addEventListener(eventName, onEvent)
    video.addEventListener('error', onError)
    signal.addEventListener('abort', onAbort)
  })
}

async function loadVideoMetadata(video: HTMLVideoElement, src: string, signal: AbortSignal) {
  const ready = waitForVideoEvent(video, 'loadedmetadata', signal)
  video.src = src
  await ready
}

async function seekVideo(video: HTMLVideoElement, time: number, signal: AbortSignal) {
  const seeked = waitForVideoEvent(video, 'seeked', signal)
  video.currentTime = time
  await seeked
}

/**
 * When a video URL has no still, capture a frame near t=0, upload it, and store the file URL.
 * Metadata also fills width/height when the node does not have them yet.
 */
export function useEnsureVideoPoster(
  nodeId: string,
  data: {
    url?: unknown
    loading?: unknown
    thumbnail?: unknown
    poster?: unknown
    cover?: unknown
    firstFrameImage?: unknown
    first_frame_image?: unknown
  },
) {
  const url = typeof data.url === 'string' ? data.url : ''
  const loading = Boolean(data.loading)
  const poster = preferredVideoPoster({ ...data, url })
  const inViewport = useCanvasNodeInViewport(nodeId, CANVAS_VIDEO_MIN_VISIBLE_RATIO)

  useEffect(() => {
    if (!url || loading || !inViewport) return
    const controller = new AbortController()
    let cancelled = false
    let video: HTMLVideoElement | null = null

    const finish = async () => {
      const latest = () => useCanvasStore.getState().nodes.find((node) => node.id === nodeId)?.data
      const blob = await runVideoPosterJob(async () => {
        const current = latest()
        if (!current || current.url !== url || cancelled || controller.signal.aborted) return null
        const needsPoster = !preferredVideoPoster(current)
        const needsSize = !readExplicitMediaPixels(current)
        if (!needsPoster && !needsSize) return null

        video = document.createElement('video')
        video.muted = true
        video.playsInline = true
        video.preload = needsPoster ? 'auto' : 'metadata'
        if (needsPoster) video.crossOrigin = 'anonymous'
        try {
          await loadVideoMetadata(video, canvasVideoCaptureSrc(url), controller.signal)
          if (cancelled || controller.signal.aborted) return null
          const width = video.videoWidth
          const height = video.videoHeight
          if (width > 0 && height > 0) {
            const patch = mediaPixelPatch(latest() || {}, { width, height })
            if (patch) useCanvasStore.getState().updateNode(nodeId, patch)
          }
          if (!needsPoster || cancelled || controller.signal.aborted) return null
          const target = videoPosterSeekTime(video.duration)
          if (target > 0) await seekVideo(video, target, controller.signal)
          else if (video.readyState < 2) await waitForVideoEvent(video, 'loadeddata', controller.signal)
          if (cancelled || controller.signal.aborted) return null
          return await captureVideoPosterBlob(video)
        } finally {
          releaseVideo(video)
          video = null
        }
      }, controller.signal)

      if (!blob || cancelled || controller.signal.aborted) return
      const thumbnail = await uploadCanvasBlob(blob)
      if (cancelled || controller.signal.aborted || !thumbnail || isInlineCanvasMedia(thumbnail)) return
      const after = latest()
      if (!after || after.url !== url || preferredVideoPoster(after)) return
      const stack = readVideoStack(after)
      const thumbnailUrls = stack.urls.length > 1
        ? stack.thumbnails.map((item, index) => (index === stack.activeIndex ? thumbnail : item))
        : undefined
      useCanvasStore.getState().updateNode(nodeId, {
        thumbnail,
        ...(thumbnailUrls ? { thumbnailUrls } : {}),
      })
    }

    void finish().catch(() => {})

    return () => {
      cancelled = true
      controller.abort()
      releaseVideo(video)
    }
  }, [inViewport, loading, nodeId, poster, url])
}
