import type {
  CharacterDTO,
  EpisodeDTO,
  ObjectDTO,
  ProjectAssetDTO,
  ProjectDTO,
  ProjectDetailDTO,
  ProjectMemberDTO,
  SceneDTO,
} from '@/api/types'
import type { Character, Episode, ObjectItem, Scene } from '@/types'

const relativeTime = (iso?: string) => {
  if (!iso) {
    return '刚刚'
  }

  const diff = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diff) || diff < 0) {
    return '刚刚'
  }

  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`

  const weeks = Math.floor(days / 7)
  return `${weeks} 周前`
}

const fallbackImage = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&h=400&fit=crop'

export const mapProjectCard = (project: ProjectDTO) => ({
  id: project.id,
  name: project.name,
  description: project.description || '',
  image: project.coverImage || fallbackImage,
  status: project.status,
  modified: relativeTime(project.updatedAt),
  code: `PJ_${String(project.id).padStart(3, '0')}`,
  assetCount: project.episodeCount ?? 0,
  updatedAt: project.updatedAt,
  organizationId: project.organizationId,
})

export const mapProjectStats = (project: ProjectDetailDTO | null) => ({
  episodeCount: project?.stats?.episodeCount ?? 0,
  sceneCount: project?.stats?.sceneCount ?? 0,
  characterCount: project?.stats?.characterCount ?? 0,
  objectCount: project?.stats?.objectCount ?? 0,
})

export const mapEpisode = (episode: EpisodeDTO): Episode => ({
  id: episode.id,
  name: episode.name,
  count: episode.sceneCount ?? episode.scenes?.length ?? 0,
  status: episode.status,
  modified: relativeTime(episode.updatedAt),
  code: episode.code,
  description: episode.description || undefined,
})

export const mapScene = (scene: SceneDTO): Scene => ({
  id: scene.id,
  name: scene.name,
  image: scene.image || fallbackImage,
  status: scene.status,
  modified: relativeTime(scene.updatedAt),
  code: `SC_${String(scene.id).padStart(3, '0')}`,
  genMethod: scene.genMethod || undefined,
  model: scene.modelId || undefined,
  description: scene.description || undefined,
})

export const mapCharacter = (character: CharacterDTO): Character => ({
  id: character.id,
  name: character.name,
  image: character.avatar || fallbackImage,
  role: character.role === 'main' ? '主角' : '配角',
  style: character.style || '默认风格',
  scenes: character.usageCount ?? 0,
  gender: character.gender || undefined,
  ageGroup: character.ageGroup || undefined,
  genMethod: character.creationMode || undefined,
  model: character.modelId || undefined,
  description: character.description || undefined,
})

const objectTypeMap: Record<ObjectDTO['type'], ObjectItem['type']> = {
  weapon: '武器',
  prop: '道具',
  clothing: '服装',
  decoration: '场景装饰',
}

export const mapObject = (object: ObjectDTO): ObjectItem => ({
  id: object.id,
  name: object.name,
  image: object.image || fallbackImage,
  type: objectTypeMap[object.type],
  status: object.status,
  scene: object.sceneId ? `场景 #${object.sceneId}` : '未关联场景',
  modified: relativeTime(object.updatedAt),
  description: object.description || undefined,
})

export const mapMember = (member: ProjectMemberDTO) => ({
  id: member.userId,
  name: member.user?.username || `用户 ${member.userId}`,
  email: member.user?.email || `user-${member.userId}@unknown.local`,
  role: member.role,
  avatar:
    member.user?.avatar ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(member.user?.username || String(member.userId))}`,
  status: 'active' as const,
  joinedAt: member.joinedAt,
})

export const mapAssetItem = (asset: ProjectAssetDTO) => ({
  id: asset.id,
  name: asset.name || `资产 ${asset.id}`,
  type: inferAssetType(asset),
  size: '--',
  status: 'approved',
  thumbnail: asset.url,
  author: `用户 ${asset.createdBy ?? '-'}`,
  updatedAt: relativeTime(asset.updatedAt),
  sourceType: asset.sourceType,
  prompt: asset.prompt || '',
})

const inferAssetType = (asset: ProjectAssetDTO): 'image' | 'video' | 'audio' | 'document' => {
  const url = asset.url.toLowerCase()
  if (/\.(mp4|mov|webm)$/i.test(url)) return 'video'
  if (/\.(mp3|wav|aac)$/i.test(url)) return 'audio'
  if (/\.(pdf|doc|docx|txt|md)$/i.test(url)) return 'document'
  return 'image'
}
