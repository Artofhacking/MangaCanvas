import { useCallback, useState } from 'react'
import { message } from 'antd'
import { isI2IModel, isKF2VModel, isT2VModel } from '@/api/aigc'
import { getDashScopeApiKey } from '@/api/core/runtime'
import { IMAGE_MODELS, VIDEO_MODELS, getImageModel, getVideoModel } from '../config/models'
import { useCanvasStore } from '../stores/canvasStore'
import { collectGenerateInputs, isGenerateNodeType } from '../utils/generateSlots'
import { useImageGeneration } from './useImageGeneration'
import { useVideoGeneration } from './useVideoGeneration'

const MISSING_MODEL_HINT = '未接模型'

export function useNodeGenerateAction(nodeId: string | null) {
  const { generate: generateImage } = useImageGeneration()
  const { generate: generateVideo } = useVideoGeneration()
  const [sending, setSending] = useState(false)

  const send = useCallback(async () => {
    if (!nodeId) return

    const { nodes, edges, addNode, addEdgeManually, updateNode, removeNode } = useCanvasStore.getState()
    const node = nodes.find((item) => item.id === nodeId)
    if (!node || !isGenerateNodeType(node.type)) return

    const model = typeof node.data.model === 'string' ? node.data.model : ''
    const apiKey = getDashScopeApiKey()
    if (!model || !apiKey) {
      message.warning(MISSING_MODEL_HINT)
      return
    }

    const localPrompt = typeof node.data.prompt === 'string' ? node.data.prompt : ''
    const inputs = collectGenerateInputs(nodeId, nodes, edges, {
      includeCamera: node.type === 'videoConfig',
      localPrompt,
    })

    const outgoing = edges.filter((edge) => edge.source === nodeId)
    const xOffset = outgoing.length * 320

    setSending(true)
    try {
      if (node.type === 'imageConfig') {
        const isI2I = isI2IModel(model)
        if (isI2I && inputs.refImages.length === 0) {
          message.warning('图生图模式需要连接图片节点（参考图）')
          return
        }
        if (!isI2I && !inputs.prompt) {
          message.warning('请先填写提示词，或连入文本节点')
          return
        }

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
          }
        } catch (err: unknown) {
          if (err instanceof Error && err.message === 'API_RATE_LIMIT') {
            removeNode(imageNodeId)
            message.warning('请求过于频繁，请稍后重试')
          } else {
            updateNode(imageNodeId, { loading: false, error: '生成失败' })
          }
        }
        return
      }

      const isT2V = isT2VModel(model)
      const isKF2V = isKF2VModel(model)
      if (isKF2V) {
        if (!inputs.firstFrameImage) {
          message.warning('请连接首帧图片节点')
          return
        }
        if (!inputs.lastFrameImage) {
          message.warning('请连接尾帧图片节点')
          return
        }
      } else if (!isT2V && !inputs.firstFrameImage) {
        message.warning('请连接图片节点（首帧图片）')
        return
      }
      if (isT2V && !inputs.prompt) {
        message.warning('请先填写提示词，或连入文本节点')
        return
      }

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
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.message === 'API_RATE_LIMIT') {
          removeNode(videoNodeId)
          message.warning('请求过于频繁，请稍后重试')
        } else {
          updateNode(videoNodeId, { loading: false, error: '生成失败' })
        }
      }
    } finally {
      setSending(false)
    }
  }, [generateImage, generateVideo, nodeId])

  return { send, sending }
}
