import { useEffect, useMemo } from 'react'
import { useModelsStore } from '@/store/modelsStore'
import type { ModelModality } from '@/api/types'

interface UseModelsOptions {
  /** 是否自动获取（默认 true） */
  autoFetch?: boolean
}

interface UseModelsReturn {
  /** 模型列表 */
  models: import('@/api/types').ModelDTO[]
  /** 加载状态 */
  loading: boolean
  /** 是否已加载 */
  isLoaded: boolean
  /** 错误信息 */
  error: string | null
  /** 重新获取（强制刷新） */
  refetch: () => Promise<void>
  /** 根据ID获取模型 */
  getModelById: (id: string) => import('@/api/types').ModelDTO | undefined
}

function useModelsByModality(modality: ModelModality, options: UseModelsOptions = {}): UseModelsReturn {
  const { autoFetch = true } = options
  const state = useModelsStore((store) => store[modality])
  const fetchModelsByModality = useModelsStore((store) => store.fetchModelsByModality)
  const getModelById = useModelsStore((store) => store.getModelById)
  const rawModels = state?.models
  const status = state?.status ?? 'idle'
  const error = state?.error ?? null

  useEffect(() => {
    const isIdle = status === 'idle'
    const hasInvalidData = status === 'success' && rawModels?.some((item) => !item.id)

    if (autoFetch && (isIdle || hasInvalidData)) {
      void fetchModelsByModality(modality)
    }
  }, [autoFetch, modality, status, rawModels, fetchModelsByModality])

  const models = useMemo(
    () => (rawModels || []).filter((item) => item.modality === modality && item.isEnabled !== false),
    [rawModels, modality]
  )

  return {
    models,
    loading: status === 'loading',
    isLoaded: status === 'success' || status === 'error',
    error,
    refetch: () => fetchModelsByModality(modality, true),
    getModelById,
  }
}

/**
 * 获取图片生成模型
 * @example
 * const { models, loading, error } = useImageModels()
 */
export function useImageModels(options?: UseModelsOptions) {
  return useModelsByModality('image', options)
}

/**
 * 获取视频生成模型
 * @example
 * const { models, loading, error } = useVideoModels()
 */
export function useVideoModels(options?: UseModelsOptions) {
  return useModelsByModality('video', options)
}

/**
 * 获取文本模型/LLM
 * @example
 * const { models, loading, error } = useTextModels()
 */
export function useTextModels(options?: UseModelsOptions) {
  return useModelsByModality('text', options)
}

/**
 * 获取音频模型
 * @example
 * const { models, loading, error } = useAudioModels()
 */
export function useAudioModels(options?: UseModelsOptions) {
  return useModelsByModality('audio', options)
}

/**
 * 获取多模态模型
 * @example
 * const { models, loading, error } = useMultimodalModels()
 */
export function useMultimodalModels(options?: UseModelsOptions) {
  return useModelsByModality('multimodal', options)
}

/**
 * 获取 Embedding 模型
 * @example
 * const { models, loading, error } = useEmbeddingModels()
 */
export function useEmbeddingModels(options?: UseModelsOptions) {
  return useModelsByModality('embedding', options)
}

/**
 * 获取 Rerank 模型
 * @example
 * const { models, loading, error } = useRerankModels()
 */
export function useRerankModels(options?: UseModelsOptions) {
  return useModelsByModality('rerank', options)
}
