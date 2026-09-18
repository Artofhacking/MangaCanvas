import { toApiResponse, successResponse, errorResponse, type ApiResponse } from './shared'

export interface ScriptPlot {
  logline?: string
  summary?: string
  themes?: string[]
  tone?: string
}

export interface ScriptCharacterDraft {
  name: string
  role?: 'main' | 'support' | ''
  gender?: 'male' | 'female' | 'other' | ''
  ageGroup?: 'child' | 'teen' | 'young' | 'middle' | 'old' | ''
  description?: string
  personality?: string
}

export interface ScriptSceneDraft {
  name: string
  location?: string
  time?: string
  description?: string
}

export interface ScriptPropDraft {
  name: string
  type?: 'weapon' | 'prop' | 'clothing' | 'decoration' | ''
  description?: string
}

export interface ScriptEpisodeDraft {
  index: number
  name: string
  summary: string
  characterNames?: string[]
  sceneNames?: string[]
  propNames?: string[]
}

export interface ScriptAgentInfo {
  provider?: string
  model?: string
  note?: string
}

export interface ScriptDocument {
  id: number
  projectId: number
  title: string
  sourceFilename?: string | null
  sourceText?: string
  plot: ScriptPlot
  characters: ScriptCharacterDraft[]
  scenes: ScriptSceneDraft[]
  props: ScriptPropDraft[]
  episodes: ScriptEpisodeDraft[]
  agent?: ScriptAgentInfo
  status: 'parsed' | 'imported' | string
  model?: string | null
  importedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface ScriptImportResult {
  script: ScriptDocument
  created: { characters: number; scenes: number; objects: number; episodes: number }
  skipped: { characters: number; scenes: number; objects: number; episodes: number }
}

export const scriptsApi = {
  async get(projectId: number, scriptId: number): Promise<ApiResponse<ScriptDocument | null>> {
    return toApiResponse<ScriptDocument>(
      { url: `/projects/${projectId}/scripts/${scriptId}`, method: 'GET' },
      {} as ScriptDocument,
      '获取剧本失败'
    ).then((response) =>
      response.success
        ? successResponse(response.data)
        : errorResponse(response.message || '获取剧本失败', null)
    )
  },

  async list(projectId: number): Promise<ApiResponse<ScriptDocument[]>> {
    return toApiResponse<{ list: ScriptDocument[] }>(
      { url: `/projects/${projectId}/scripts`, method: 'GET', params: { page: 1, size: 10 } },
      { list: [] },
      '获取剧本列表失败'
    ).then((response) =>
      response.success
        ? successResponse(response.data.list || [])
        : errorResponse(response.message || '获取剧本列表失败', [])
    )
  },

  async parse(
    projectId: number,
    data: { text: string; title?: string; filename?: string }
  ): Promise<ApiResponse<ScriptDocument | null>> {
    return toApiResponse<ScriptDocument>(
      { url: `/projects/${projectId}/scripts/parse`, method: 'POST', data },
      {} as ScriptDocument,
      '剧本解析失败'
    ).then((response) =>
      response.success
        ? successResponse(response.data)
        : errorResponse(response.message || '剧本解析失败', null)
    )
  },

  async importToProject(
    projectId: number,
    scriptId: number,
    data: {
      characters: ScriptCharacterDraft[]
      scenes: ScriptSceneDraft[]
      props: ScriptPropDraft[]
      episodes: ScriptEpisodeDraft[]
      skipExisting?: boolean
    }
  ): Promise<ApiResponse<ScriptImportResult | null>> {
    return toApiResponse<ScriptImportResult>(
      { url: `/projects/${projectId}/scripts/${scriptId}/import`, method: 'POST', data },
      {} as ScriptImportResult,
      '写入项目资产失败'
    ).then((response) =>
      response.success
        ? successResponse(response.data)
        : errorResponse(response.message || '写入项目资产失败', null)
    )
  },
}
