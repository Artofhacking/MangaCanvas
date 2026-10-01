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
import { createRandomUuid } from '@/lib/randomUuid'
import { buildGeneratedImageNodePatch } from '../utils/imageStack'
import { collectVideoBatch } from '../utils/videoBatch'
import { buildGeneratedVideoNodePatch } from '../utils/videoStack'
import {
  imageSizeForRequest,
  listVideoRequestImages,
  normalizeVideoQuantity,
  resolveImageRequestModel,
  videoRequestParams,
} from '../utils/generateParams'
import { usablePosterUrl } from '../utils/videoPoster'

const DEFAULT_IMAGE_MODEL = 'gpt-image-2'
const DEFAULT_VIDEO_MODEL = 'happyhorse-1.1-t2v'

async function persistGeneratedMediaUrls(urls: readonly string[], signal: AbortSignal): Promise<string[]> {
  const stored: string[] = []
  for (const item of urls) {
    if (signal.aborted) return stored
    const trimmed = item.trim()
    if (!trimmed) continue
    try {
      const next = isInlineCanvasMedia(trimmed) ? await uploadCanvasMediaUrl(trimmed) : trimmed
      const clean = next.trim()
      if (clean) stored.push(clean)
    } catch {
      // Keep the candidates that did upload.
    }
  }
  return stored
}

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
    const selectedModel = isImage
      ? remapModelId(storedModel || DEFAULT_IMAGE_MODEL, liveIds, 'image')
      : remapModelId(storedModel || DEFAULT_VIDEO_MODEL, liveIds, 'video')
    const model = isImage
      ? resolveImageRequestModel(selectedModel, inputs.refImages.length, liveIds)
      : selectedModel

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
        const requested = typeof node.data.n === 'number' && node.data.n > 0 ? node.data.n : 1
        const imageQuality = typeof node.data.quality === 'string' ? node.data.quality : undefined
        const result = await generateImage({
          model,
          prompt: inputs.prompt,
          size: imageSizeForRequest(
            model,
            imageQuality,
            typeof node.data.size === 'string' ? node.data.size : undefined,
            typeof node.data.ratio === 'string' ? node.data.ratio : undefined
          ),
          quality: imageQuality,
          image: inputs.refImages[0],
          images: inputs.refImages.length ? inputs.refImages : undefined,
          n: requested,
          signal,
        }, applyProgress)

        if (signal.aborted) return

        const returned = (result || []).filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        const stored = await persistGeneratedMediaUrls(returned, signal)
        if (signal.aborted || !finishGenerationJob(nodeId, signal)) return

        const outcome = buildGeneratedImageNodePatch({
          urls: stored,
          requestedCount: requested,
          nodeId,
        })
        updateNode(nodeId, outcome.patch)
        if (outcome.notice.level === 'success') message.success(outcome.notice.text)
        else if (outcome.notice.level === 'warning') message.warning(outcome.notice.text)
        else message.error(outcome.notice.text)
        return
      }

      const requested = normalizeVideoQuantity(node.data.n)
      const poster = usablePosterUrl(inputs.firstFrameImage)
      const videoImages = listVideoRequestImages(inputs.firstFrameImage, inputs.refImages)
      const videoFields = videoRequestParams({
        model,
        referenceCount: videoImages.length,
        ratio: typeof node.data.ratio === 'string' ? node.data.ratio : undefined,
        resolution: typeof node.data.resolution === 'string' ? node.data.resolution : undefined,
        size: typeof node.data.size === 'string' ? node.data.size : undefined,
      })
      const videoParams = {
        model,
        prompt: inputs.prompt || '',
        first_frame_image: videoImages[0] || inputs.firstFrameImage,
        last_frame_image: inputs.lastFrameImage,
        images: videoImages.length ? videoImages : undefined,
        seconds: typeof node.data.duration === 'number' ? node.data.duration : 5,
        size: videoFields.size,
        resolution: videoFields.resolution,
        ratio: videoFields.ratio,
        nodeId,
        signal,
      }
      const reportClip = (status: string, percent?: number) => {
        if (signal.aborted) return
        updateNode(nodeId, {
          ...(status ? { statusLabel: status } : {}),
          ...(typeof percent === 'number' && Number.isFinite(percent) ? { progress: percent } : {}),
        })
      }

      let returned: string[] = []
      let rateLimited = false
      let errorMessage = ''

      if (requested === 1) {
        const videoUrl = await generateVideo(videoParams, reportClip)
        returned = videoUrl ? [videoUrl] : []
      } else {
        const batchId = createRandomUuid()
        let finished = 0
        const percents: Array<number | undefined> = Array.from({ length: requested }, () => undefined)
        const phases = Array.from({ length: requested }, () => '排队中')
        const publish = () => {
          if (signal.aborted) return
          const known = percents.filter((item): item is number => typeof item === 'number')
          const percent = known.length
            ? Math.round(known.reduce((sum, item) => sum + item, 0) / requested)
            : undefined
          const phase = phases.find((item) => item && item !== '排队中') || '排队中'
          updateNode(nodeId, {
            statusLabel: finished > 0 ? `已完成 ${finished}/${requested}` : phase,
            ...(typeof percent === 'number' ? { progress: percent } : {}),
          })
        }
        const batch = await collectVideoBatch({
          count: requested,
          signal,
          onProgress: (countFinished) => {
            finished = countFinished
            publish()
          },
          run: (index) => generateVideo({
            ...videoParams,
            batchId,
            quiet: true,
          }, (status, percent) => {
            if (status) phases[index] = status
            if (typeof percent === 'number' && Number.isFinite(percent)) percents[index] = percent
            publish()
          }),
        })
        returned = batch.urls
        rateLimited = batch.rateLimited
        errorMessage = batch.errorMessage || ''
      }

      if (signal.aborted) return
      const stored = await persistGeneratedMediaUrls(returned, signal)
      if (signal.aborted || !finishGenerationJob(nodeId, signal)) return
      if (stored.length === 0 && rateLimited) throw new Error('API_RATE_LIMIT')

      const outcome = buildGeneratedVideoNodePatch({
        urls: stored,
        posters: poster ? stored.map(() => poster) : undefined,
        requestedCount: requested,
        nodeId,
      })
      if (!outcome.ok && errorMessage) outcome.patch.error = errorMessage
      updateNode(nodeId, outcome.patch)
      if (requested === 1 && outcome.ok) return
      if (outcome.notice.level === 'success') message.success(outcome.notice.text)
      else if (outcome.notice.level === 'warning') message.warning(outcome.notice.text)
      else message.error(typeof outcome.patch.error === 'string' && outcome.patch.error ? outcome.patch.error : outcome.notice.text)
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
