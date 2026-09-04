import { useEffect } from 'react'
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
  const store = useModelsStore()
  // 安全访问：如果状态不存在，提供默认值
  const state = store[modality] || { models: [], status: 'idle', error: null, lastFetchedAt: null }

  // 自动获取数据（只触发一次，或缓存为空时重新获取）
  useEffect(() => {
    // 如果状态是 idle，触发请求
    const isIdle = state.status === 'idle'
    // 如果状态是成功但数据为空或缺少 id，也重新请求（可能是之前缓存的坏数据）
    const hasInvalidData = state.status === 'success' && state.models?.some(m => !m.id)
    const isEmptySuccess = state.status === 'success' && (!state.models || state.models.length === 0)
    
    if (autoFetch && (isIdle || isEmptySuccess || hasInvalidData)) {
      store.fetchModelsByModality(modality)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, modality, state.status, state.models])

  // 安全获取模型列表
  const models = state.models || []

  return {
    // 过滤：只返回匹配的 modality 且启用的模型
    models: models.filter(m => m.modality === modality && m.isEnabled !== false),
    loading: state.status === 'loading',
    isLoaded: state.status === 'success' || state.status === 'error',
    error: state.error,
    refetch: () => store.fetchModelsByModality(modality, true),
    getModelById: store.getModelById,
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
