import { describe, expect, it } from 'vitest'
import {
  canvasVideoCaptureSrc,
  posterDrawSize,
  preferredVideoPoster,
  proxyDashscopeVideoUrl,
  usablePosterUrl,
  videoPosterSeekTime,
} from './videoPoster'

describe('preferred video poster', () => {
  it('uses an upstream still and skips inline bytes and the video file itself', () => {
    expect(preferredVideoPoster({
      url: 'https://cdn.example/clip.mp4',
      thumbnail: 'data:image/jpeg;base64,AAAA',
      first_frame_image: 'https://cdn.example/first.png',
    })).toBe('https://cdn.example/first.png')

    expect(preferredVideoPoster({
      url: 'https://cdn.example/clip.mp4',
      thumbnail: 'https://cdn.example/clip.mp4',
      poster: 'https://cdn.example/poster.jpg',
    })).toBe('https://cdn.example/poster.jpg')

    expect(usablePosterUrl('blob:http://local/1')).toBe('')
    expect(usablePosterUrl('https://cdn.example/clip.webm?token=1')).toBe('')
    expect(preferredVideoPoster({ url: 'https://cdn.example/clip.mp4' })).toBe('')
  })
})

describe('video poster capture', () => {
  it('seeks just past t=0 and keeps a short clip at the start', () => {
    expect(videoPosterSeekTime(5)).toBe(0.05)
    expect(videoPosterSeekTime(0.04)).toBe(0)
    expect(videoPosterSeekTime(Number.NaN)).toBe(0)
    expect(videoPosterSeekTime(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('shrinks the stored JPEG without changing the reported video resolution', () => {
    expect(posterDrawSize(1920, 1080)).toEqual({ width: 1280, height: 720 })
    expect(posterDrawSize(800, 600)).toEqual({ width: 800, height: 600 })
    expect(posterDrawSize(0, 720)).toBeNull()
  })

  it('routes DashScope results through the canvas proxy', () => {
    expect(proxyDashscopeVideoUrl(
      'https://dashscope-result-sh.oss-cn-shanghai.aliyuncs.com/a/b.mp4?x=1',
    )).toBe('/oss-proxy-sh/a/b.mp4?x=1')
    expect(canvasVideoCaptureSrc(
      'https://dashscope-result-wlcb.oss-cn-wulanchabu.aliyuncs.com/clip.mp4',
    )).toBe('/oss-proxy-wlcb/clip.mp4')
    expect(canvasVideoCaptureSrc('https://cdn.example/clip.mp4')).toBe('https://cdn.example/clip.mp4')
  })
})
