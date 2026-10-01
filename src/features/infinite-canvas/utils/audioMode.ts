import type { ModelDTO, ModelParameterSet } from '@/api/types'

/** One audio card. Mode lives on the node, not a second config type. */
export type AudioNodeMode = 'tts' | 'sfx' | 'music'

export const AUDIO_MODE_OPTIONS: ReadonlyArray<{ key: AudioNodeMode; label: string }> = [
  { key: 'tts', label: '配音' },
  { key: 'sfx', label: '音效' },
  { key: 'music', label: '音乐' },
]

export const AUDIO_SFX_UNAVAILABLE_MESSAGE = '音效生成通道尚未开放，可先上传本地音频'
export const AUDIO_TTS_EMPTY_MESSAGE = '请先填写要朗读的台词'
export const AUDIO_MUSIC_EMPTY_MESSAGE = '请先填写音乐风格，或连入歌词'

export function readAudioMode(value: unknown): AudioNodeMode {
  return value === 'sfx' || value === 'music' ? value : 'tts'
}

export function audioModeLabel(mode: AudioNodeMode): string {
  return AUDIO_MODE_OPTIONS.find((item) => item.key === mode)?.label || '配音'
}

export function audioPromptPlaceholder(mode: AudioNodeMode): string {
  if (mode === 'sfx') return '描述音效；通道未开放时可先上传本地音频'
  if (mode === 'music') return '描述风格。连入文本会当作歌词；没有歌词时自动写词'
  return '输入要朗读的台词，输入 @ 引用已连入的文本…'
}

export function audioModePatch(mode: AudioNodeMode): { audioMode: AudioNodeMode } {
  return { audioMode: mode }
}

type CatalogRow = {
  id?: string
  key?: string
  task?: string
  parameters?: ModelDTO['parameters']
  isEnabled?: boolean
}

function parameterTask(parameters: ModelDTO['parameters'] | undefined): 'tts' | 'music' | undefined {
  if (!parameters || Array.isArray(parameters) || typeof parameters !== 'object') return undefined
  const task = (parameters as ModelParameterSet).task
  return task === 'tts' || task === 'music' ? task : undefined
}

/** Live `/ai/models` task wins. Otherwise speech-* is 配音 and music-* is 音乐. */
export function audioCatalogTask(model: CatalogRow): 'tts' | 'music' | null {
  if (model.task === 'tts' || model.task === 'music') return model.task
  const declared = parameterTask(model.parameters)
  if (declared) return declared
  const id = model.key || model.id || ''
  if (/^speech-/i.test(id)) return 'tts'
  if (/^music-/i.test(id)) return 'music'
  return null
}

/**
 * 配音 and 音乐 follow the live audio catalog.
 * 音效 has no MiniMax model, so the list stays empty and generate stays disabled.
 */
export function audioModelsForMode<T extends CatalogRow>(models: readonly T[], mode: AudioNodeMode): T[] {
  if (mode === 'sfx') return []
  const wanted = mode === 'music' ? 'music' : 'tts'
  return models.filter((model) => {
    if (model.isEnabled === false) return false
    if (!model.id && !model.key) return false
    return audioCatalogTask(model) === wanted
  })
}

export function audioGenerateBlockedMessage(mode: AudioNodeMode, catalogCount: number): string {
  if (mode === 'sfx') return AUDIO_SFX_UNAVAILABLE_MESSAGE
  if (catalogCount === 0) return '当前没有可用的音频模型'
  return mode === 'tts' ? '当前没有可用的配音模型' : '当前没有可用的音乐模型'
}

export interface CanvasAudioRequestBody {
  model: string
  text?: string
  prompt?: string
  lyrics?: string
  voiceId?: string
  lyricsOptimizer?: boolean
}

export type CanvasAudioRequest =
  | { ok: true; body: CanvasAudioRequestBody }
  | { ok: false; message: string }

/** Body for the merged `audioService.generate()` / POST /ai/audios/generations. */
export function buildCanvasAudioRequest(input: {
  mode: AudioNodeMode
  model: string
  prompt: string
  lyrics?: string
  voiceId?: string
}): CanvasAudioRequest {
  if (input.mode === 'sfx') return { ok: false, message: AUDIO_SFX_UNAVAILABLE_MESSAGE }
  const model = input.model.trim()
  if (!model) return { ok: false, message: audioGenerateBlockedMessage(input.mode, 0) }
  const prompt = input.prompt.trim()
  const lyrics = (input.lyrics || '').trim()
  if (input.mode === 'tts') {
    if (!prompt) return { ok: false, message: AUDIO_TTS_EMPTY_MESSAGE }
    const voiceId = input.voiceId?.trim()
    return { ok: true, body: { model, text: prompt, ...(voiceId ? { voiceId } : {}) } }
  }
  if (!prompt && !lyrics) return { ok: false, message: AUDIO_MUSIC_EMPTY_MESSAGE }
  return {
    ok: true,
    body: {
      model,
      ...(prompt ? { prompt } : {}),
      ...(lyrics ? { lyrics } : { lyricsOptimizer: true }),
    },
  }
}
