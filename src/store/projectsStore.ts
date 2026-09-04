import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProjectDTO } from '@/api/types'
import { projectsApi } from '@/api'
import { getCurrentUser } from '@/lib/session'

interface ProjectsState {
  // 缓存的项目列表
  projects: ProjectDTO[]
  
  // 状态
  isLoading: boolean
  isLoaded: boolean
  error: string | null
  lastFetchedAt: number | null
  
  // actions
  fetchProjects: (force?: boolean) => Promise<void>
  getProjectById: (id: number) => ProjectDTO | undefined
  clearCache: () => void
}

// 缓存有效期：2分钟（项目列表变化相对频繁）
const CACHE_TTL = 2 * 60 * 1000
// 错误后最小重试间隔：30秒
const ERROR_RETRY_INTERVAL = 30 * 1000

export const useProjectsStore = create<ProjectsState>()(
  persist(
    (set, get) => ({
      // 初始状态
      projects: [],
      isLoading: false,
      isLoaded: false,
      error: null,
      lastFetchedAt: null,

      // 获取项目列表（全局只请求一次）
      fetchProjects: async (force = false) => {
        const { isLoading, isLoaded, lastFetchedAt, error } = get()
        
        // 如果正在加载，不重复请求
        if (isLoading) return
        
        // 如果已加载且未过期，不重复请求（除非强制刷新）
        if (!force && isLoaded && lastFetchedAt) {
          const isExpired = Date.now() - lastFetchedAt > CACHE_TTL
          if (!isExpired) return
        }

        // 如果上次出错且在冷却期内，不重复请求
        if (!force && error && lastFetchedAt) {
          const isInCooldown = Date.now() - lastFetchedAt < ERROR_RETRY_INTERVAL
          if (isInCooldown) {
            console.log('[ProjectsStore] 上次请求失败，冷却期内跳过')
            return
          }
        }

        set({ isLoading: true, error: null })

        try {
          const user = getCurrentUser()
          const organizationId = user?.organizationIds?.[0]
          const response = await projectsApi.list({ page: 1, size: 100, organizationId })
          
          if (response.list) {
            set({
              projects: response.list,
              isLoading: false,
              isLoaded: true,
              lastFetchedAt: Date.now(),
              error: null,
            })
          } else {
            set({
              isLoading: false,
              isLoaded: true,
              error: '获取项目列表失败',
              lastFetchedAt: Date.now(),
            })
          }
        } catch (err) {
          set({
            isLoading: false,
            isLoaded: true,
            error: err instanceof Error ? err.message : '获取项目列表失败',
            lastFetchedAt: Date.now(),
          })
        }
      },

      // 根据ID获取项目
      getProjectById: (id: number) => {
        return get().projects.find(p => p.id === id)
      },
      
      // 清除缓存
      clearCache: () => {
        set({
          projects: [],
          isLoading: false,
          isLoaded: false,
          error: null,
          lastFetchedAt: null,
        })
      },
    }),
    {
      name: 'projects-storage',
      // 只持久化数据，不持久化状态
      partialize: (state) => ({
        projects: state.projects,
        lastFetchedAt: state.lastFetchedAt,
      }),
    }
  )
)

// 强制刷新函数
export function refreshProjects() {
  const store = useProjectsStore.getState()
  return store.fetchProjects(true)
}
