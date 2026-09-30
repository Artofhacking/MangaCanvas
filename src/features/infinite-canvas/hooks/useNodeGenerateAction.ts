import { useCallback, useState } from 'react'
import { message } from 'antd'
import { isI2IModel, UNSUPPORTED_REFERENCE_IMAGE_MESSAGE } from '@/api/aigc'
import { isCanceledError } from '@/api/core'
import { remapModelId, resolveImageCapabilities, resolveVideoCapabilities } from '../config/modelCapabilities'
import { useModelsStore } from '@/store/modelsStore'
import { useCanvasStore } from '../stores/canvasStore'
import { finishGenerationJob, hasGenerationJob, startGenerationJob } from '../utils/generationJobs'
import { collectGenerateInputs, getIncomingReferenceSlots, isGenerateNodeType } from '../utils/generateSlots'
import { resolveMentionsForSend } from '../utils/promptMentions'
import { useImageGeneration } from './useImageGeneration'
import { useVideoGeneration } from './useVideoGeneration'
import { isInlineCanvasMedia } from '@/lib/canvasPayload'
import { uploadCanvasMediaUrl } from '@/lib/uploadCanvasMedia'
import { nextMediaPixelFields } from '../utils/mediaFrame'
import { usablePosterUrl } from '../utils/videoPoster'

const DEFAULT_IMAGE_MODEL = 'gpt-image-2'
const DEFAULT_VIDEO_MODEL = 'happyhorse-1.1-t2v'

function toErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message && err.message !== 'API_RATE_LIMIT') {
    return err.message
  }
  return fallback
}

export function useNodeGenerateAction(nodeId: string | null) {
  const { generate: generateImage } = useImageGeneration()
  const { generate: generateVideo } = useVideoGeneration()
  const [sending, setSending] = useState(false)

  const send = useCallback(async (barPrompt?: string) => {
    if (!nodeId) return

    const { nodes, edges, updateNode } = useCanvasStore.getState()
    const node = nodes.find((item) => item.id === nodeId)
    if (!node || !isGenerateNodeType(node.type)) return

    const storedPrompt = typeof node.data.prompt === 'string' ? node.data.prompt : ''
    const localPrompt = (barPrompt ?? storedPrompt).trim()
    if (barPrompt !== undefined && barPrompt !== storedPrompt) {
      updateNode(nodeId, { prompt: barPrompt })
    }

    const slots = getIncomingReferenceSlots(nodeId, nodes, edges)
    const resolvedPrompt = resolveMentionsForSend(localPrompt, slots)
    const inputs = collectGenerateInputs(nodeId, nodes, edges, {
      includeCamera: node.type === 'videoConfig',
      localPrompt: resolvedPrompt,
      promptSource: 'bar',
    })

    const isImage = node.type === 'imageConfig'
    const liveIds = useModelsStore
      .getState()
      .getModelsByModality(isImage ? 'image' : 'video')
      .map((item) => item.id)
    const storedModel = typeof node.data.model === 'string' ? node.data.model : ''
    const model = isImage
      ? remapModelId(storedModel || DEFAULT_IMAGE_MODEL, liveIds, 'image')
      : remapModelId(storedModel || DEFAULT_VIDEO_MODEL, liveIds, 'video')

    if (isImage && inputs.refImages.length && !isI2IModel(model)) {
      message.error(UNSUPPORTED_REFERENCE_IMAGE_MESSAGE)
      return
    }
    const liveName = useModelsStore.getState().getModelById(model)?.name
    const modelLabel = isImage
      ? (liveName || resolveImageCapabilities(model).label || model)
      : (liveName || resolveVideoCapabilities(model).label || model)

    const signal = startGenerationJob(nodeId)
    const applyProgress = (_status: string, percent?: number) => {
      if (signal.aborted) return
      if (typeof percent === 'number' && Number.isFinite(percent)) {
        updateNode(nodeId, { progress: percent })
      }
    }

    setSending(true)
    updateNode(nodeId, {
      loading: true,
      error: '',
      progress: undefined,
      statusLabel: isImage ? undefined : '排队中',
      model,
      modelLabel,
    })

    try {
      if (isImage) {
        const result = await generateImage({
          model,
          prompt: inputs.prompt,
          size: typeof node.data.size === 'string' ? node.data.size : '1024x1024',
          quality: typeof node.data.quality === 'string' ? node.data.quality : undefined,
          image: inputs.refImages[0],
          images: inputs.refImages.length ? inputs.refImages : undefined,
          n: typeof node.data.n === 'number' && node.data.n > 0 ? node.data.n : 1,
          signal,
        }, applyProgress)

        if (signal.aborted || !finishGenerationJob(nodeId, signal)) return

        if (result && result.length > 0) {
          const generatedUrl = isInlineCanvasMedia(result[0])
            ? await uploadCanvasMediaUrl(result[0])
            : result[0]
          updateNode(nodeId, {
            url: generatedUrl,
            base64: undefined,
            thumbnail: undefined,
            ...nextMediaPixelFields(null),
            loading: false,
            error: '',
            progress: undefined,
            updatedAt: Date.now(),
            executed: true,
            outputNodeId: nodeId,
          })
          message.success('图片生成成功！')
        } else {
          updateNode(nodeId, { loading: false, error: '生成失败', progress: undefined })
          message.error('生成失败')
        }
        return
      }

      const videoUrl = await generateVideo({
        model,
        prompt: inputs.prompt || '',
        first_frame_image: inputs.firstFrameImage,
        last_frame_image: inputs.lastFrameImage,
        seconds: typeof node.data.duration === 'number' ? node.data.duration : 5,
        size: typeof node.data.size === 'string' ? node.data.size : undefined,
        resolution: typeof node.data.resolution === 'string' ? node.data.resolution : undefined,
        nodeId,
        signal,
      }, (status, percent) => {
        if (signal.aborted) return
        updateNode(nodeId, {
          ...(status ? { statusLabel: status } : {}),
          ...(typeof percent === 'number' && Number.isFinite(percent) ? { progress: percent } : {}),
        })
      })

      if (signal.aborted || !finishGenerationJob(nodeId, signal)) return

      if (videoUrl) {
        const storedVideoUrl = isInlineCanvasMedia(videoUrl)
          ? await uploadCanvasMediaUrl(videoUrl)
          : videoUrl
        const poster = usablePosterUrl(inputs.firstFrameImage)
        updateNode(nodeId, {
          url: storedVideoUrl,
          thumbnail: poster,
          ...nextMediaPixelFields(null),
          loading: false,
          error: '',
          progress: undefined,
          statusLabel: undefined,
          updatedAt: Date.now(),
          executed: true,
          outputNodeId: nodeId,
        })
      } else {
        updateNode(nodeId, { loading: false, error: '生成失败', progress: undefined, statusLabel: undefined })
        message.error('生成失败')
      }
    } catch (err: unknown) {
      if (signal.aborted) return
      if (isCanceledError(err)) {
        updateNode(nodeId, { loading: false, error: '', progress: undefined, statusLabel: undefined })
        return
      }
      if (err instanceof Error && err.message === 'API_RATE_LIMIT') {
        updateNode(nodeId, { loading: false, progress: undefined, statusLabel: undefined })
        message.warning('请求过于频繁，请稍后重试')
      } else {
        updateNode(nodeId, {
          loading: false,
          error: toErrorMessage(err, '生成失败'),
          progress: undefined,
          statusLabel: undefined,
        })
      }
    } finally {
      const ownsJob = finishGenerationJob(nodeId, signal)
      const superseded = signal.aborted && hasGenerationJob(nodeId)
      if (!superseded) setSending(false)
      if (ownsJob) {
        const current = useCanvasStore.getState().nodes.find((item) => item.id === nodeId)
        if (current?.data.loading) {
          const existing = typeof current.data.error === 'string' ? current.data.error : ''
          updateNode(nodeId, {
            loading: false,
            progress: undefined,
            statusLabel: undefined,
            error: existing || '生成失败',
          })
        }
      }
    }
  }, [generateImage, generateVideo, nodeId])

  return { send, sending }
}
