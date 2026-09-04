import type { Character, CharacterCreateData } from '@/types'
import type { CharacterDTO } from '@/api/types'
import { mapCharacter } from '@/lib/projectMappers'
import { errorResponse, successResponse, toApiResponse } from './shared'
import type { ApiResponse } from './shared'

const buildCharacterPayload = (data: CharacterCreateData) => ({
  name: data.name,
  role: data.role,
  gender: data.gender,
  ageGroup: data.ageGroup,
  style: data.style,
  description: data.description,
  avatar: data.referenceImage,
  referenceImages: data.referenceImage ? [data.referenceImage] : [],
  modelId: data.model,
  seed: data.seed,
  creationMode: 'quick',
})

export const charactersApi = {
  async getAll(projectId: number, role?: 'main' | 'support'): Promise<ApiResponse<Character[]>> {
    return toApiResponse<{ list: CharacterDTO[] }, never>(
      {
        url: `/projects/${projectId}/characters`,
        method: 'GET',
        params: role ? { role } : undefined,
      },
      { list: [] },
      '获取角色列表失败',
      (data) => ({ ...data, list: data.list.map(mapCharacter) as unknown as CharacterDTO[] })
    ).then((response) =>
      response.success ? successResponse(response.data.list as unknown as Character[]) : errorResponse(response.message || '获取角色列表失败', [])
    )
  },

  async getById(projectId: number, id: number): Promise<ApiResponse<Character | null>> {
    return toApiResponse<CharacterDTO | null>(
      {
        url: `/projects/${projectId}/characters/${id}`,
        method: 'GET',
      },
      null,
      '获取角色详情失败',
      (data) => (data ? (mapCharacter(data) as unknown as CharacterDTO) : null)
    ).then((response) =>
      response.success ? successResponse((response.data as unknown as Character | null) ?? null) : errorResponse(response.message || '获取角色详情失败', null)
    )
  },

  async create(projectId: number, data: CharacterCreateData): Promise<ApiResponse<Character>> {
    return toApiResponse<CharacterDTO, ReturnType<typeof buildCharacterPayload>>(
      {
        url: `/projects/${projectId}/characters`,
        method: 'POST',
        data: buildCharacterPayload(data),
      },
      {} as CharacterDTO,
      '创建角色失败',
      (result) => mapCharacter(result) as unknown as CharacterDTO
    ).then((response) =>
      response.success ? successResponse(response.data as unknown as Character) : errorResponse(response.message || '创建角色失败', {} as Character)
    )
  },

  async update(projectId: number, id: number, data: Partial<Character>): Promise<ApiResponse<Character | null>> {
    return toApiResponse<CharacterDTO | null>(
      {
        url: `/projects/${projectId}/characters/${id}`,
        method: 'PUT',
        data: {
          name: data.name,
          style: data.style,
          description: data.description,
          avatar: data.image,
        },
      },
      null,
      '更新角色失败',
      (result) => (result ? (mapCharacter(result) as unknown as CharacterDTO) : null)
    ).then((response) =>
      response.success ? successResponse((response.data as unknown as Character | null) ?? null) : errorResponse(response.message || '更新角色失败', null)
    )
  },

  async delete(projectId: number, id: number): Promise<ApiResponse<boolean>> {
    return toApiResponse<true>(
      {
        url: `/projects/${projectId}/characters/${id}`,
        method: 'DELETE',
      },
      true,
      '删除角色失败'
    ).then((response) =>
      response.success ? successResponse(true) : errorResponse(response.message || '删除角色失败', false)
    )
  },

  async duplicate(projectId: number, id: number): Promise<ApiResponse<Character | null>> {
    const characterResponse = await this.getById(projectId, id)
    if (!characterResponse.success || !characterResponse.data) {
      return errorResponse(characterResponse.message || '复制角色失败', null)
    }

    return this.create(projectId, {
      name: `${characterResponse.data.name} (复制)`,
      gender: characterResponse.data.gender || 'other',
      ageGroup: characterResponse.data.ageGroup || 'young',
      role: characterResponse.data.role === '主角' ? 'main' : 'support',
      genMethod: characterResponse.data.genMethod || 'model',
      model: characterResponse.data.model || '',
      style: characterResponse.data.style,
      description: characterResponse.data.description || '',
      referenceImage: characterResponse.data.image,
    }).then((response) => (response.success ? successResponse(response.data) : errorResponse(response.message || '复制角色失败', null)))
  },
}
