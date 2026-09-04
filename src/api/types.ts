export interface Pagination {
  page: number
  size: number
  total: number
}

export interface ListData<T> {
  list: T[]
  pagination?: Pagination
}

export interface AuthPayload {
  user: {
    id: number
    username: string
    email: string
    avatar: string | null
    roleId: number
    credits?: number
    createdAt?: string
    updatedAt?: string
  }
  token: string
  refreshToken: string
}

export interface AuthMe {
  id: number
  username: string
  email: string
  avatar: string | null
  roleId: number
  role?: {
    id: number
    code: string
    name: string
  }
  organizationIds?: number[]
  credits?: number
  createdAt?: string
  updatedAt?: string
}

export interface ProjectDTO {
  id: number
  organizationId: number
  name: string
  description?: string | null
  coverImage?: string | null
  status: 'draft' | 'in-progress' | 'completed'
  isPublic?: boolean
  ownerId?: number
  progress?: number
  episodeCount?: number
  updatedAt?: string
  createdAt?: string
}

export interface ProjectDetailDTO extends ProjectDTO {
  owner?: {
    id: number
    username: string
    avatar: string | null
  }
  members?: Array<{
    userId: number
    role: 'owner' | 'editor' | 'viewer'
    joinedAt: string
  }>
  stats?: {
    episodeCount: number
    sceneCount: number
    characterCount: number
    objectCount: number
    totalDuration?: number
  }
}

export interface ProjectMemberDTO {
  userId: number
  organizationId: number
  role: 'owner' | 'editor' | 'viewer'
  assignedBy?: number | null
  joinedAt: string
  user?: {
    id: number
    username: string
    avatar: string | null
    email?: string
  }
}

export interface ProjectAssetDTO {
  id: number
  organizationId: number
  projectId: number
  name?: string | null
  sourceType: 'workflow' | 'workflow_node' | 'character' | 'scene' | 'project_object' | 'episode'
  sourceId: string
  prompt?: string | null
  url: string
  metadata?: Record<string, unknown> | null
  createdBy?: number
  createdAt: string
  updatedAt: string
}

export interface CharacterDTO {
  id: number
  organizationId: number
  projectId: number
  name: string
  role: 'main' | 'support'
  gender?: 'male' | 'female' | 'other' | null
  ageGroup?: 'child' | 'teen' | 'young' | 'middle' | 'old' | null
  style?: string | null
  description?: string | null
  avatar?: string | null
  referenceImages?: string[]
  modelId?: string | null
  seed?: string | null
  creationMode?: 'quick' | 'workflow'
  sourceWorkflowId?: string | null
  sourceNodeId?: string | null
  usageCount?: number
  createdAt?: string
  updatedAt?: string
}

export interface SceneDTO {
  id: number
  organizationId: number
  projectId: number
  name: string
  description?: string | null
  image?: string | null
  status: 'draft' | 'in-use'
  genMethod?: 'model' | 'upload' | 'angle' | 'custom' | null
  modelId?: string | null
  style?: string | null
  camera?: Record<string, unknown> | null
  referenceImages?: string[]
  seed?: string | null
  creationMode?: 'quick' | 'workflow'
  sourceWorkflowId?: string | null
  sourceNodeId?: string | null
  usageCount?: number
  createdAt?: string
  updatedAt?: string
}

export interface ObjectDTO {
  id: number
  organizationId: number
  projectId: number
  name: string
  type: 'weapon' | 'prop' | 'clothing' | 'decoration'
  description?: string | null
  image?: string | null
  sceneId?: number | null
  status: 'draft' | 'in-use'
  genMethod?: string | null
  referenceImages?: string[]
  creationMode?: 'quick' | 'workflow'
  sourceWorkflowId?: string | null
  sourceNodeId?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface EpisodeRelationRef {
  id: number
  name: string
}

export interface EpisodeDTO {
  id: number
  organizationId: number
  projectId: number
  name: string
  code: string
  description?: string | null
  status: 'draft' | 'in-progress' | 'completed'
  progress?: number
  duration?: number
  creationMode?: 'quick' | 'workflow'
  sourceWorkflowId?: string | null
  sourceNodeId?: string | null
  characters?: EpisodeRelationRef[]
  scenes?: EpisodeRelationRef[]
  objects?: EpisodeRelationRef[]
  sceneCount?: number
  createdAt?: string
  updatedAt?: string
}

// AI 模型相关类型
export type ModelModality = 'text' | 'image' | 'video' | 'audio' | 'embedding' | 'rerank' | 'multimodal'

export interface ModelCapability {
  key: string
  label: string
  description?: string
}

export interface ModelParameter {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'enum'
  options?: { label: string; value: string | number }[]
  defaultValue?: string | number | boolean
  min?: number
  max?: number
  required?: boolean
  description?: string
}

export interface ModelDTO {
  id: string
  model_id?: string  // API 返回的原始字段
  name: string
  provider: string
  modality: ModelModality
  description?: string
  capabilities?: ModelCapability[]
  parameters?: ModelParameter[]
  defaultParams?: Record<string, unknown>
  isEnabled: boolean
  icon?: string
  tags?: string[]
  createdAt?: string
  updatedAt?: string
  status?: string  // API 返回的启用状态字段
}

// ==================== 工作流相关类型 ====================

export interface WorkflowDTO {
  id: string
  organizationId?: number
  projectId: number
  name: string
  thumbnail?: string | null
  sourceType?: 'blank' | 'episode' | 'scene' | 'character' | 'object'
  sourceAssetId?: number | null
  status?: 'draft' | 'active' | 'archived'
  canvasData?: {
    nodes: unknown[]
    edges: unknown[]
    viewport?: { x: number; y: number; zoom: number }
  }
  createdBy?: number
  createdAt?: string
  updatedAt?: string
}

export interface CreateWorkflowInput {
  name: string
  thumbnail?: string
  sourceType?: 'blank' | 'episode' | 'scene' | 'character' | 'object'
  sourceAssetId?: number
  sourceEpisodeId?: number
  canvasData?: {
    nodes: unknown[]
    edges: unknown[]
    viewport?: { x: number; y: number; zoom: number }
  }
}

export interface UpdateWorkflowInput {
  name?: string
  thumbnail?: string
  sourceType?: 'blank' | 'episode' | 'scene' | 'character' | 'object'
  sourceAssetId?: number
  status?: 'draft' | 'active' | 'archived'
  canvasData?: {
    nodes: unknown[]
    edges: unknown[]
    viewport?: { x: number; y: number; zoom: number }
  }
}

export interface WorkflowMemberDTO {
  userId: number
  workflowId?: string
  projectId?: number
  role: 'editor' | 'viewer'
  joinedAt?: string
  assignedBy?: number
  user?: {
    id: number
    username: string
    avatar: string | null
    email?: string
  }
}
