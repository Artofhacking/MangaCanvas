import { message } from 'antd'

import { videoService } from '@/api/aigc'
import { useCanvasStore } from '@/features/infinite-canvas/stores/canvasStore'
import { persistOpenCanvas } from '@/lib/persistCanvas'

export const ACT_VIDEO_MODEL = 'happyhorse-1.1-r2v'
export const ACT_VIDEO_SIZE = '1280*720'
export const ACT_VIDEO_RESOLUTION = '720P'
export const ACT_VIDEO_DURATION = 5
export const ACT_VIDEO_MAX_IMAGES = 3

const SPEECH_LINE = /^([^\n：:]{1,24})[：:](.+)$/

export type ActRefImage = {
  id: string
  url: string
  name: string
}

export function collectActReferenceImages(actId: string): ActRefImage[] {
  const { nodes, edges } = useCanvasStore.getState()
  const incoming = edges.filter((edge) => edge.target === actId)
  const outgoing = edges.filter((edge) => edge.source === actId)
  const characters: ActRefImage[] = []
  const scenes: ActRefImage[] = []

  const take = (nodeId: string, bucket: ActRefImage[]) => {
    const node = nodes.find((item) => item.id === nodeId)
    if (node?.type !== 'image') return
    const url = String(node.data.url || node.data.base64 || '')
    if (!url) return
    bucket.push({ id: node.id, url, name: String(node.data.label || '') })
  }

  incoming.forEach((edge) => take(edge.source, characters))
  outgoing.forEach((edge) => take(edge.target, scenes))

  const merged: ActRefImage[] = []
  const seen = new Set<string>()
  for (const item of [...characters, ...scenes]) {
    if (seen.has(item.url) || seen.has(item.id)) continue
    seen.add(item.url)
    seen.add(item.id)
    merged.push(item)
    if (merged.length >= ACT_VIDEO_MAX_IMAGES) break
  }
  return merged
}

export function buildActVideoPrompt(
  heading: string,
  plot: string,
  imageNames: string[],
  duration = ACT_VIDEO_DURATION
) {
  const names = imageNames.map((name, index) => name.trim() || `参考图${index + 1}`)
  const imageHints = names.map((name, index) => `第${index + 1}张参考图是${name}`).join('，')
  const cleaned = plot.replace(/@/g, '').trim()
  const speeches = cleaned
    .split('\n')
    .map((line) => line.trim())
    .flatMap((line) => {
      const match = line.match(SPEECH_LINE)
      if (!match) return []
      const speaker = match[1].trim()
      const lineText = match[2].trim()
      if (!speaker || !lineText) return []
      return [`${speaker}说：「${lineText}」`]
    })
  const speechHint = speeches.length
    ? `必须开口的台词：${speeches.join('；')}。口型与台词同步。`
    : '这一幕没有对白，不要凭空加台词，保留环境声。'
  return `${imageHints}。${heading}。按以下剧情生成有声视频，必须在${duration}秒内演完。${speechHint}不要改词，也不要另外加台词：\n${cleaned}`
}

export async function generateActVideo(actId: string) {
  const store = useCanvasStore.getState()
  const act = store.nodes.find((node) => node.id === actId)
  if (!act) {
    message.warning('找不到这一幕')
    return
  }

  const prompt = String(act.data.content || act.data.value || '').trim()
  if (!prompt) {
    message.warning('这一幕没有剧情文案')
    return
  }

  const refs = collectActReferenceImages(actId)
  if (!refs.length) {
    message.warning('这一幕还没有角色或场景参考图')
    return
  }

  const urls = refs.map((item) => item.url)
  const imageNames = refs.map((item, index) => item.name || `参考图${index + 1}`)
  const heading = String(act.data.label || '')
  const videoPrompt = buildActVideoPrompt(heading, prompt, imageNames, ACT_VIDEO_DURATION)
  message.info(`使用 ${refs.length} 张参考图生成本幕视频`)
  const outgoing = store.edges.filter((edge) => edge.source === actId)
  const existingVideo = outgoing
    .map((edge) => store.nodes.find((node) => node.id === edge.target && node.type === 'video'))
    .find((node) => node)

  if (existingVideo?.data.loading) {
    message.info('这一幕正在生成视频')
    return
  }

  let videoId = existingVideo?.id
  if (videoId) {
    store.updateNode(videoId, {
      loading: true,
      error: '',
      url: '',
      prompt: videoPrompt,
      model: ACT_VIDEO_MODEL,
      modelLabel: '本幕视频',
    })
  } else {
    videoId = store.addNode(
      'video',
      { x: (act.position?.x || 0) + 420, y: (act.position?.y || 0) },
      {
        label: `${String(act.data.label || '本幕')} 视频`,
        loading: true,
        prompt: videoPrompt,
        model: ACT_VIDEO_MODEL,
        modelLabel: '本幕视频',
        size: ACT_VIDEO_SIZE,
        resolution: ACT_VIDEO_RESOLUTION,
        duration: ACT_VIDEO_DURATION,
      }
    )
    useCanvasStore.getState().addEdgeManually({ source: actId, target: videoId })
  }
  persistOpenCanvas()

  try {
    const videoUrl = await videoService.generate({
      model: ACT_VIDEO_MODEL,
      prompt: videoPrompt,
      firstFrameImage: urls[0],
      images: urls,
      imageNames,
      size: ACT_VIDEO_SIZE,
      resolution: ACT_VIDEO_RESOLUTION,
      duration: ACT_VIDEO_DURATION,
    })
    useCanvasStore.getState().updateNode(videoId, { url: videoUrl, loading: false, updatedAt: Date.now() })
    persistOpenCanvas()
  } catch (error) {
    if (error instanceof Error && error.message === 'API_RATE_LIMIT') {
      useCanvasStore.getState().removeNode(videoId)
      persistOpenCanvas()
      message.warning('请求过于频繁，请稍后重试')
      return
    }
    useCanvasStore.getState().updateNode(videoId, {
      loading: false,
      error: error instanceof Error ? error.message : '生成失败',
    })
    persistOpenCanvas()
  }
}
