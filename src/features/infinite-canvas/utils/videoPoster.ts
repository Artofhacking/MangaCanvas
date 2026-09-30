/**
 * Idle video cards show a still of the first frame.
 * Prefer an upstream image URL. Otherwise the card captures one JPEG and stores that URL.
 */

import { isInlineCanvasMedia } from '@/lib/canvasPayload'
import { mediaUrl } from '@/lib/mediaUrl'
import { fitDisplayEdge } from './canvasDisplayBitmap'

export const VIDEO_POSTER_SEEK_SECONDS = 0.05
export const VIDEO_POSTER_MAX_EDGE = 1280
export const VIDEO_POSTER_JPEG_QUALITY = 0.82

const POSTER_FIELDS = ['thumbnail', 'poster', 'cover', 'firstFrameImage', 'first_frame_image'] as const

function isProbablyVideoUrl(url: string): boolean {
  const path = url.split(/[?#]/)[0] || ''
  return /\.(mp4|webm|mov|m4v|ogg)$/i.test(path)
}

/** Image URL safe to store on a node. Inline bytes and video files are not posters. */
export function usablePosterUrl(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed || isInlineCanvasMedia(trimmed) || isProbablyVideoUrl(trimmed)) return ''
  return trimmed
}

export function preferredVideoPoster(data: {
  url?: unknown
  thumbnail?: unknown
  poster?: unknown
  cover?: unknown
  firstFrameImage?: unknown
  first_frame_image?: unknown
} | null | undefined): string {
  if (!data) return ''
  const videoUrl = typeof data.url === 'string' ? data.url.trim() : ''
  for (const field of POSTER_FIELDS) {
    const poster = usablePosterUrl(data[field])
    if (!poster || (videoUrl && poster === videoUrl)) continue
    return poster
  }
  return ''
}

/** A hair past t=0 so the decoder has painted a frame. Exact 0 is often still black. */
export function videoPosterSeekTime(duration: number, offset = VIDEO_POSTER_SEEK_SECONDS): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0
  if (duration <= offset * 2) return 0
  return offset
}

export function posterDrawSize(videoWidth: number, videoHeight: number, maxEdge = VIDEO_POSTER_MAX_EDGE) {
  if (!(videoWidth > 0) || !(videoHeight > 0)) return null
  return fitDisplayEdge(videoWidth, videoHeight, maxEdge)
}

export function proxyDashscopeVideoUrl(url: string): string {
  if (!url) return ''
  if (url.includes('dashscope-result-sh.oss-cn-shanghai.aliyuncs.com')) {
    return url.replace('https://dashscope-result-sh.oss-cn-shanghai.aliyuncs.com', '/oss-proxy-sh')
  }
  if (url.includes('dashscope-result-wlcb.oss-cn-wulanchabu.aliyuncs.com')) {
    return url.replace('https://dashscope-result-wlcb.oss-cn-wulanchabu.aliyuncs.com', '/oss-proxy-wlcb')
  }
  return url
}

export function canvasVideoCaptureSrc(url: string): string {
  return mediaUrl(proxyDashscopeVideoUrl(url))
}

export function captureVideoPosterBlob(
  video: HTMLVideoElement,
  maxEdge = VIDEO_POSTER_MAX_EDGE,
): Promise<Blob> {
  const size = posterDrawSize(video.videoWidth, video.videoHeight, maxEdge)
  if (!size) return Promise.reject(new Error('视频尺寸未知'))
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('Canvas 初始化失败'))
  context.drawImage(video, 0, 0, size.width, size.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('截帧失败'))
    }, 'image/jpeg', VIDEO_POSTER_JPEG_QUALITY)
  })
}
