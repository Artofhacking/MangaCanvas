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

    const { nodes, edges, addNode, addEdgeManually, updateNode, removeNode } = useCanvasStore.getState()
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

    const outgoing = edges.filter((edge) => edge.source === nodeId)
    const xOffset = outgoing.length * 320

    setSending(true)
    try {
      if (node.type === 'imageConfig') {
        const model = (typeof node.data.model === 'string' && node.data.model) || DEFAULT_IMAGE_MODEL
        const modelLabel = getImageModel(model)?.label || IMAGE_MODELS.find((item) => item.key === model)?.label || model
        const imageNodeId = addNode(
          'image',
          { x: node.position.x + 400 + xOffset, y: node.position.y },
          {
            url: '',
            loading: true,
            label: '图像生成结果',
            prompt: inputs.prompt || '',
            model,
            modelLabel,
            size: node.data.size,
            ratio: node.data.ratio,
          }
        )
        addEdgeManually({ source: nodeId, target: imageNodeId })

        try {
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
            updateNode(imageNodeId, { url: result[0], loading: false, updatedAt: Date.now() })
            message.success('图片生成成功！')
          } else {
            updateNode(imageNodeId, { loading: false, error: '生成失败' })
            message.error('生成失败')
          }
        } catch (err: unknown) {
          if (err instanceof Error && err.message === 'API_RATE_LIMIT') {
            removeNode(imageNodeId)
            message.warning('请求过于频繁，请稍后重试')
          } else {
            const errorMessage = toErrorMessage(err, '生成失败')
            updateNode(imageNodeId, { loading: false, error: errorMessage })
          }
        }
        return
      }

      const model = remapVideoModel(
        (typeof node.data.model === 'string' && node.data.model) || DEFAULT_VIDEO_MODEL
      )
      const modelLabel = getVideoModel(model)?.label || VIDEO_MODELS.find((item) => item.key === model)?.label || model
      const videoNodeId = addNode(
        'video',
        { x: node.position.x + 400 + xOffset, y: node.position.y },
        {
          label: '视频生成结果',
          loading: true,
          prompt: inputs.prompt || '',
          model,
          modelLabel,
          size: node.data.size,
          resolution: node.data.resolution,
          duration: node.data.duration,
        }
      )
      addEdgeManually({ source: nodeId, target: videoNodeId })

      try {
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
          updateNode(videoNodeId, { url: videoUrl, loading: false, updatedAt: Date.now() })
        } else {
          updateNode(videoNodeId, { loading: false, error: '生成失败' })
          message.error('生成失败')
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.message === 'API_RATE_LIMIT') {
          removeNode(videoNodeId)
          message.warning('请求过于频繁，请稍后重试')
        } else {
          const errorMessage = toErrorMessage(err, '生成失败')
          updateNode(videoNodeId, { loading: false, error: errorMessage })
        }
      }
    } finally {
      setSending(false)
    }
  }, [generateImage, generateVideo, nodeId])

  return { send, sending }
}
