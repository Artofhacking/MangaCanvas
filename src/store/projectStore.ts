import { create } from 'zustand'
import { projectApi } from '@/api/projectApi'
import type { ObjectDTO, EpisodeDTO } from '@/api/types'
import type {
  Character,
  CharacterCreateData,
  Episode,
  EpisodeCreateData,
  ObjectCreateData,
  ObjectItem,
  ProjectTab,
  Scene,
  SceneCreateData,
  Workflow,
} from '@/types'

interface ProjectState {
  activeTab: ProjectTab
  currentPage: number
  initializedProjectId: number | null
  isLoading: boolean
  error: string | null
  ui: {
    isSceneDrawerOpen: boolean
    isEpisodeDrawerOpen: boolean
    isCharacterDrawerOpen: boolean
    isObjectDrawerOpen: boolean
  }
  assets: {
    episodes: Episode[]
    scenes: Scene[]
    characters: Character[]
    objects: ObjectItem[]
  }
  workflows: Workflow[]
  workflowPagination?: {
    page: number
    size: number
    total: number
  }
}

interface ProjectActions {
  setActiveTab: (tab: ProjectTab) => void
  setCurrentPage: (page: number) => void
  openDrawer: (type: 'scene' | 'episode' | 'character' | 'object') => void
  closeDrawer: (type: 'scene' | 'episode' | 'character' | 'object') => void
  closeAllDrawers: () => void
  setAssets: (type: keyof ProjectState['assets'], data: Episode[] | Scene[] | Character[] | ObjectItem[]) => void
  loadProjectAssets: (projectId: number, force?: boolean) => Promise<void>
  loadCharacters: (projectId: number, role?: 'main' | 'support') => Promise<void>
  loadObjects: (projectId: number, type?: ObjectDTO['type']) => Promise<void>
  loadEpisodes: (projectId: number, status?: EpisodeDTO['status']) => Promise<void>
  createEpisode: (projectId: number, data: EpisodeCreateData) => Promise<Episode | null>
  updateEpisode: (projectId: number, id: number, data: Partial<Episode>) => Promise<Episode | null>
  deleteEpisode: (projectId: number, id: number) => Promise<boolean>
  duplicateEpisode: (projectId: number, id: number) => Promise<Episode | null>
  createScene: (projectId: number, data: SceneCreateData) => Promise<Scene | null>
  updateScene: (projectId: number, id: number, data: Partial<Scene>) => Promise<Scene | null>
  deleteScene: (projectId: number, id: number) => Promise<boolean>
  duplicateScene: (projectId: number, id: number) => Promise<Scene | null>
  createCharacter: (projectId: number, data: CharacterCreateData) => Promise<Character | null>
  updateCharacter: (projectId: number, id: number, data: Partial<Character>) => Promise<Character | null>
  deleteCharacter: (projectId: number, id: number) => Promise<boolean>
  duplicateCharacter: (projectId: number, id: number) => Promise<Character | null>
  createObject: (projectId: number, data: ObjectCreateData) => Promise<ObjectItem | null>
  updateObject: (projectId: number, id: number, data: Partial<ObjectItem>) => Promise<ObjectItem | null>
  deleteObject: (projectId: number, id: number) => Promise<boolean>
  duplicateObject: (projectId: number, id: number) => Promise<ObjectItem | null>
  bulkDelete: (projectId: number, type: keyof ProjectState['assets'], ids: number[]) => Promise<void>
  reset: () => void
}

export type ProjectStore = ProjectState & ProjectActions

const initialState: ProjectState = {
  activeTab: 'scenes',
  currentPage: 1,
  initializedProjectId: null,
  isLoading: false,
  error: null,
  ui: {
    isSceneDrawerOpen: false,
    isEpisodeDrawerOpen: false,
    isCharacterDrawerOpen: false,
    isObjectDrawerOpen: false,
  },
  assets: {
    episodes: [],
    scenes: [],
    characters: [],
    objects: [],
  },
  workflows: [],
}

const replaceAsset = <T extends { id: number }>(items: T[], nextItem: T) =>
  items.map((item) => (item.id === nextItem.id ? nextItem : item))

const removeAsset = <T extends { id: number }>(items: T[], id: number) =>
  items.filter((item) => item.id !== id)

export const useProjectStore = create<ProjectStore>((set, get) => ({
  ...initialState,

  setActiveTab: (tab) => set({ activeTab: tab, currentPage: 1 }),
  setCurrentPage: (page) => set({ currentPage: page }),

  openDrawer: (type) => {
    const key = `is${type.charAt(0).toUpperCase() + type.slice(1)}DrawerOpen` as keyof ProjectState['ui']
    set((state) => ({ ui: { ...state.ui, [key]: true } }))
  },

  closeDrawer: (type) => {
    const key = `is${type.charAt(0).toUpperCase() + type.slice(1)}DrawerOpen` as keyof ProjectState['ui']
    set((state) => ({ ui: { ...state.ui, [key]: false } }))
  },

  closeAllDrawers: () =>
    set({
      ui: {
        isSceneDrawerOpen: false,
        isEpisodeDrawerOpen: false,
        isCharacterDrawerOpen: false,
        isObjectDrawerOpen: false,
      },
    }),

  setAssets: (type, data) =>
    set((state) => ({
      assets: {
        ...state.assets,
        [type]: data,
      },
    })),

  loadProjectAssets: async (projectId, force = false) => {
    const state = get()
    if (!force && state.initializedProjectId === projectId) {
      return
    }

    set({ isLoading: true, error: null })

    try {
      const [episodes, scenes, characters, objects] = await Promise.all([
        projectApi.episodes.getAll(projectId),
        projectApi.scenes.getAll(projectId),
        projectApi.characters.getAll(projectId),
        projectApi.objects.getAll(projectId),
      ])

      const firstError = [episodes, scenes, characters, objects].find((result) => !result.success)
      if (firstError) {
        throw new Error(firstError.message || '加载项目资产失败')
      }

      set({
        initializedProjectId: projectId,
        isLoading: false,
        assets: {
          episodes: episodes.data,
          scenes: scenes.data,
          characters: characters.data,
          objects: objects.data,
        },
      })
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : '加载项目资产失败',
      })
    }
  },

  loadCharacters: async (projectId, role) => {
    set({ isLoading: true, error: null })
    try {
      const response = await projectApi.characters.getAll(projectId, role)
      if (!response.success) {
        throw new Error(response.message || '加载角色列表失败')
      }
      set((state) => ({
        isLoading: false,
        assets: {
          ...state.assets,
          characters: response.data,
        },
      }))
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : '加载角色列表失败',
      })
    }
  },

  loadObjects: async (projectId, type) => {
    set({ isLoading: true, error: null })
    try {
      const response = await projectApi.objects.getAll(projectId, type)
      if (!response.success) {
        throw new Error(response.message || '加载物品列表失败')
      }
      set((state) => ({
        isLoading: false,
        assets: {
          ...state.assets,
          objects: response.data,
        },
      }))
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : '加载物品列表失败',
      })
    }
  },

  loadEpisodes: async (projectId, status) => {
    set({ isLoading: true, error: null })
    try {
      const response = await projectApi.episodes.getAll(projectId, status)
      if (!response.success) {
        throw new Error(response.message || '加载片段列表失败')
      }
      set((state) => ({
        isLoading: false,
        assets: {
          ...state.assets,
          episodes: response.data,
        },
      }))
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : '加载片段列表失败',
      })
    }
  },

  createEpisode: async (projectId, data) => {
    const response = await projectApi.episodes.create(projectId, data)
    if (!response.success) {
      set({ error: response.message || '创建片段失败' })
      return null
    }

    set((state) => ({
      assets: {
        ...state.assets,
        episodes: [response.data, ...state.assets.episodes],
      },
    }))
    return response.data
  },

  updateEpisode: async (projectId, id, data) => {
    const response = await projectApi.episodes.update(projectId, id, data)
    if (!response.success || !response.data) {
      set({ error: response.message || '更新片段失败' })
      return null
    }
    const updatedEpisode = response.data

    set((state) => ({
      assets: {
        ...state.assets,
        episodes: replaceAsset<Episode>(state.assets.episodes, updatedEpisode),
      },
    }))
    return updatedEpisode
  },

  deleteEpisode: async (projectId, id) => {
    const response = await projectApi.episodes.delete(projectId, id)
    if (!response.success) {
      set({ error: response.message || '删除片段失败' })
      return false
    }

    set((state) => ({
      assets: {
        ...state.assets,
        episodes: removeAsset(state.assets.episodes, id),
      },
    }))
    return true
  },

  duplicateEpisode: async (projectId, id) => {
    const response = await projectApi.episodes.duplicate(projectId, id)
    if (!response.success || !response.data) {
      set({ error: response.message || '复制片段失败' })
      return null
    }
    const duplicatedEpisode = response.data

    set((state) => ({
      assets: {
        ...state.assets,
        episodes: [duplicatedEpisode, ...state.assets.episodes],
      },
    }))
    return duplicatedEpisode
  },

  createScene: async (projectId, data) => {
    const response = await projectApi.scenes.create(projectId, data)
    if (!response.success) {
      set({ error: response.message || '创建场景失败' })
      return null
    }

    set((state) => ({
      assets: {
        ...state.assets,
        scenes: [response.data, ...state.assets.scenes],
      },
    }))
    return response.data
  },

  updateScene: async (projectId, id, data) => {
    const response = await projectApi.scenes.update(projectId, id, data)
    if (!response.success || !response.data) {
      set({ error: response.message || '更新场景失败' })
      return null
    }
    const updatedScene = response.data

    set((state) => ({
      assets: {
        ...state.assets,
        scenes: replaceAsset<Scene>(state.assets.scenes, updatedScene),
      },
    }))
    return updatedScene
  },

  deleteScene: async (projectId, id) => {
    const response = await projectApi.scenes.delete(projectId, id)
    if (!response.success) {
      set({ error: response.message || '删除场景失败' })
      return false
    }

    set((state) => ({
      assets: {
        ...state.assets,
        scenes: removeAsset(state.assets.scenes, id),
      },
    }))
    return true
  },

  duplicateScene: async (projectId, id) => {
    const response = await projectApi.scenes.duplicate(projectId, id)
    if (!response.success || !response.data) {
      set({ error: response.message || '复制场景失败' })
      return null
    }
    const duplicatedScene = response.data

    set((state) => ({
      assets: {
        ...state.assets,
        scenes: [duplicatedScene, ...state.assets.scenes],
      },
    }))
    return duplicatedScene
  },

  createCharacter: async (projectId, data) => {
    const response = await projectApi.characters.create(projectId, data)
    if (!response.success) {
      set({ error: response.message || '创建角色失败' })
      return null
    }

    set((state) => ({
      assets: {
        ...state.assets,
        characters: [response.data, ...state.assets.characters],
      },
    }))
    return response.data
  },

  updateCharacter: async (projectId, id, data) => {
    const response = await projectApi.characters.update(projectId, id, data)
    if (!response.success || !response.data) {
      set({ error: response.message || '更新角色失败' })
      return null
    }
    const updatedCharacter = response.data

    set((state) => ({
      assets: {
        ...state.assets,
        characters: replaceAsset<Character>(state.assets.characters, updatedCharacter),
      },
    }))
    return updatedCharacter
  },

  deleteCharacter: async (projectId, id) => {
    const response = await projectApi.characters.delete(projectId, id)
    if (!response.success) {
      set({ error: response.message || '删除角色失败' })
      return false
    }

    set((state) => ({
      assets: {
        ...state.assets,
        characters: removeAsset(state.assets.characters, id),
      },
    }))
    return true
  },

  duplicateCharacter: async (projectId, id) => {
    const response = await projectApi.characters.duplicate(projectId, id)
    if (!response.success || !response.data) {
      set({ error: response.message || '复制角色失败' })
      return null
    }
    const duplicatedCharacter = response.data

    set((state) => ({
      assets: {
        ...state.assets,
        characters: [duplicatedCharacter, ...state.assets.characters],
      },
    }))
    return duplicatedCharacter
  },

  createObject: async (projectId, data) => {
    const response = await projectApi.objects.create(projectId, data)
    if (!response.success) {
      set({ error: response.message || '创建物品失败' })
      return null
    }

    set((state) => ({
      assets: {
        ...state.assets,
        objects: [response.data, ...state.assets.objects],
      },
    }))
    return response.data
  },

  updateObject: async (projectId, id, data) => {
    const response = await projectApi.objects.update(projectId, id, data)
    if (!response.success || !response.data) {
      set({ error: response.message || '更新物品失败' })
      return null
    }
    const updatedObject = response.data

    set((state) => ({
      assets: {
        ...state.assets,
        objects: replaceAsset<ObjectItem>(state.assets.objects, updatedObject),
      },
    }))
    return updatedObject
  },

  deleteObject: async (projectId, id) => {
    const response = await projectApi.objects.delete(projectId, id)
    if (!response.success) {
      set({ error: response.message || '删除物品失败' })
      return false
    }

    set((state) => ({
      assets: {
        ...state.assets,
        objects: removeAsset(state.assets.objects, id),
      },
    }))
    return true
  },

  duplicateObject: async (projectId, id) => {
    const response = await projectApi.objects.duplicate(projectId, id)
    if (!response.success || !response.data) {
      set({ error: response.message || '复制物品失败' })
      return null
    }
    const duplicatedObject = response.data

    set((state) => ({
      assets: {
        ...state.assets,
        objects: [duplicatedObject, ...state.assets.objects],
      },
    }))
    return duplicatedObject
  },

  bulkDelete: async (projectId, type, ids) => {
    const actionMap = {
      episodes: (id: number) => get().deleteEpisode(projectId, id),
      scenes: (id: number) => get().deleteScene(projectId, id),
      characters: (id: number) => get().deleteCharacter(projectId, id),
      objects: (id: number) => get().deleteObject(projectId, id),
    } as const

    await Promise.all(ids.map((id) => actionMap[type](id)))
  },

  reset: () => set({ ...initialState }),
}))
