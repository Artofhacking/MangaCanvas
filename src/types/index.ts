/**
 * 全局类型定义
 * 统一存放项目中的所有类型，避免散落在组件文件中
 */

// ==================== 基础类型 ====================

export type EntityStatus = 'draft' | 'in-progress' | 'completed' | 'in-use' | 'archived'

export type CharacterRole = '主角' | '配角'

export type ObjectType = '武器' | '道具' | '服装' | '场景装饰' | 'AI生成' | '上传'

export type GenerationMethod = 'ai' | 'upload' | 'mix'

export type WorkflowSourceType = 'blank' | 'episode' | 'scene' | 'character' | 'object' | string
export type WorkflowStatus = 'draft' | 'active' | 'archived'

// ==================== 片段 (Episode) ====================

export interface Episode {
  id: number
  name: string
  count: number
  status: 'completed' | 'in-progress' | 'draft'
  modified: string
  code: string
  description?: string
}

export interface EpisodeCreateData {
  folderName: string
  episodeCount: string
  description: string
}

// ==================== 场景 (Scene) ====================

export interface Scene {
  id: number
  name: string
  image: string
  status: 'in-use' | 'draft'
  modified: string
  code: string
  genMethod?: string
  model?: string
  description?: string
}

export interface SceneCreateData {
  name: string
  genMethod: string
  referenceImage?: string
  shotType?: string
  distance: number
  zoom?: number
  model: string
  description: string
  status: 'in-use' | 'draft'
}

// ==================== 角色 (Character) ====================

export interface Character {
  id: number
  name: string
  image: string
  role: CharacterRole
  style: string
  scenes: number
  gender?: string
  ageGroup?: string
  genMethod?: string
  model?: string
  description?: string
  seed?: string
  seedMode?: 'random' | 'fixed'
}

export interface CharacterCreateData {
  name: string
  gender: string
  ageGroup: string
  role?: 'main' | 'support'
  genMethod: string
  model: string
  style?: string
  description: string
  referenceImage?: string
  seed?: string
  seedMode?: 'random' | 'fixed'
  quantity?: number
}

export interface CharacterEditData extends CharacterCreateData {
  id: number
}

// ==================== 物品 (Object) ====================

export interface ObjectItem {
  id: number
  name: string
  image: string
  type: ObjectType
  status: 'in-use' | 'draft'
  scene: string
  modified: string
  description?: string
  genMethod?: string
}

export interface ObjectCreateData {
  name: string
  genMethod: 'model' | 'upload'
  model?: string
  prompt?: string
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3'
  referenceImage?: string
  referenceImages?: string[]
}

// ==================== 项目工作台状态 ====================

export type ProjectTab = 'episodes' | 'scenes' | 'characters' | 'objects' | 'workflows'

export interface Workflow {
  id: string
  projectId: string
  name: string
  sourceType: WorkflowSourceType
  sourceAssetId?: number
  status: WorkflowStatus
  modified: string
  thumbnail?: string
  canvasData?: {
    nodes: unknown[]
    edges: unknown[]
    viewport?: { x: number; y: number; zoom: number }
  }
}
