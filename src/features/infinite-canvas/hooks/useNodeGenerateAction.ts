import { useCallback, useState } from 'react'
import { message } from 'antd'
import { IMAGE_MODELS, VIDEO_MODELS, getImageModel, getVideoModel, remapVideoModel } from '../config/models'
import { useCanvasStore } from '../stores/canvasStore'
import { collectGenerateInputs, getIncomingReferenceSlots, isGenerateNodeType } from '../utils/generateSlots'
import { resolveMentionsForSend } from '../utils/promptMentions'
import { useImageGeneration } from './useImageGeneration'
import { useVideoGeneration } from './useVideoGeneration'

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
    const model = isImage
      ? ((typeof node.data.model === 'string' && node.data.model) || DEFAULT_IMAGE_MODEL)
      : remapVideoModel((typeof node.data.model === 'string' && node.data.model) || DEFAULT_VIDEO_MODEL)
    const modelLabel = isImage
      ? (getImageModel(model)?.label || IMAGE_MODELS.find((item) => item.key === model)?.label || model)
      : (getVideoModel(model)?.label || VIDEO_MODELS.find((item) => item.key === model)?.label || model)

    setSending(true)
    updateNode(nodeId, {
      loading: true,
      error: '',
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
          n: 1,
        })

        if (result && result.length > 0) {
          updateNode(nodeId, {
            url: result[0],
            loading: false,
            error: '',
            updatedAt: Date.now(),
            executed: true,
            outputNodeId: nodeId,
          })
          message.success('图片生成成功！')
        } else {
          updateNode(nodeId, { loading: false, error: '生成失败' })
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
      })

      if (videoUrl) {
        updateNode(nodeId, {
          url: videoUrl,
          loading: false,
          error: '',
          updatedAt: Date.now(),
          executed: true,
          outputNodeId: nodeId,
        })
      } else {
        updateNode(nodeId, { loading: false, error: '生成失败' })
        message.error('生成失败')
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'API_RATE_LIMIT') {
        updateNode(nodeId, { loading: false })
        message.warning('请求过于频繁，请稍后重试')
      } else {
        updateNode(nodeId, { loading: false, error: toErrorMessage(err, '生成失败') })
      }
    } finally {
      setSending(false)
    }
  }, [generateImage, generateVideo, nodeId])

  return { send, sending }
}
