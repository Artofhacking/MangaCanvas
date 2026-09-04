import { create } from 'zustand'
import type { ModelDTO, ModelModality } from '@/api/types'
import { modelsApi } from '@/features/infinite-canvas/api/models'

type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

interface ModalityState {
  models: ModelDTO[]
  status: FetchStatus
  error: string | null
  lastFetchedAt: number | null
}

interface ModelsState {
  // 按 modality 分别管理状态
  image: ModalityState
  video: ModalityState
  text: ModalityState
  audio: ModalityState
  embedding: ModalityState
  rerank: ModalityState
  multimodal: ModalityState
  
  //  actions
  fetchModelsByModality: (modality: ModelModality, force?: boolean) => Promise<void>
  getModelsByModality: (modality: ModelModality) => ModelDTO[]
  getModelById: (id: string) => ModelDTO | undefined
  clearCache: () => void
}

// 错误后最小重试间隔：30秒
const ERROR_RETRY_INTERVAL = 30 * 1000

const initialModalityState: ModalityState = {
  models: [],
  status: 'idle',
  error: null,
  lastFetchedAt: null,
}

// 安全的初始状态（处理 localStorage 中旧数据）
const createInitialState = (): Omit<ModelsState, 'fetchModelsByModality' | 'getModelsByModality' | 'getModelById' | 'clearCache'> => ({
  image: { ...initialModalityState },
  video: { ...initialModalityState },
  text: { ...initialModalityState },
  audio: { ...initialModalityState },
  embedding: { ...initialModalityState },
  rerank: { ...initialModalityState },
  multimodal: { ...initialModalityState },
})

export const useModelsStore = create<ModelsState>()(
    (set, get) => ({
      ...createInitialState(),

      // 按 modality 获取模型列表
      fetchModelsByModality: async (modality: ModelModality, force = false) => {
        const state = get()[modality]
        // 安全处理：如果 state 不存在，使用默认值
        const { status, lastFetchedAt } = state || initialModalityState
        
        // 如果正在加载，不重复请求
        if (status === 'loading') return
        
        // 如果已成功且未过期，不重复请求（除非强制刷新）
        if (!force && status === 'success' && lastFetchedAt) {
          const CACHE_TTL = 5 * 60 * 1000  // 5分钟
          const isExpired = Date.now() - lastFetchedAt > CACHE_TTL
          if (!isExpired) return
        }

        // 如果上次出错且在冷却期内，不重复请求
        if (!force && status === 'error' && lastFetchedAt) {
          const isInCooldown = Date.now() - lastFetchedAt < ERROR_RETRY_INTERVAL
          if (isInCooldown) {
            console.log(`[ModelsStore] ${modality} 上次请求失败，冷却期内跳过`)
            return
          }
        }

        // 更新状态为加载中
        set((prev) => ({
          ...prev,
          [modality]: { ...(prev[modality] || initialModalityState), status: 'loading', error: null },
        }))

        try {
          const response = await modelsApi.getModels(modality)
          
          if (response.success) {
            set((prev) => ({
              ...prev,
              [modality]: {
                models: response.data,
                status: 'success',
                error: null,
                lastFetchedAt: Date.now(),
              },
            }))
          } else {
            set((prev) => ({
              ...prev,
              [modality]: {
                ...(prev[modality] || initialModalityState),
                status: 'error',
                error: response.message || '获取模型列表失败',
                lastFetchedAt: Date.now(),
              },
            }))
          }
        } catch (err) {
          set((prev) => ({
            ...prev,
            [modality]: {
              ...(prev[modality] || initialModalityState),
              status: 'error',
              error: err instanceof Error ? err.message : '获取模型列表失败',
              lastFetchedAt: Date.now(),
            },
          }))
        }
      },

      // 获取指定类型的模型
      getModelsByModality: (modality: ModelModality) => {
        const state = get()[modality]
        // 安全处理：如果 state 或 models 不存在，返回空数组
        if (!state || !state.models) return []
        // 过滤 isEnabled，如果不存在则默认为 true
        return state.models.filter(m => m.isEnabled !== false)
      },

      // 根据ID获取模型
      getModelById: (id: string) => {
        const { image, video, text, audio, embedding, rerank, multimodal } = get()
        const allModels = [
          ...(image?.models || []),
          ...(video?.models || []),
          ...(text?.models || []),
          ...(audio?.models || []),
          ...(embedding?.models || []),
          ...(rerank?.models || []),
          ...(multimodal?.models || []),
        ]
        return allModels.find(m => m.id === id)
      },
      
      clearCache: () => {
        set(createInitialState())
      },
    }),
)

