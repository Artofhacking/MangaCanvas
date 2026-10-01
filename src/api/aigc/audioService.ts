import { appClient } from '@/api/clients/appClient'
import { isCanceledError } from '@/api/core/error'
import { requestData } from '@/api/core/response'
import { applyBillingPayload, withIdempotentGenerate, type BillingPayload } from '@/lib/billing'
import { resolveProjectId } from '@/lib/session'
import { formatAiError } from '@/lib/formatAiError'
import { titleFromPrompt, useGenerationHistoryStore } from '@/store/generationHistoryStore'

export const isMiniMaxTtsModel = (model: string) => /^speech-/i.test(model)

export const isMiniMaxMusicModel = (model: string) => /^music-/i.test(model)

export interface AudioGenerateOptions {
  /** Catalog id: speech-2.8-hd, speech-2.8-turbo, or music-3.0. */
  model?: string
  /** Music style. For TTS, used when `text` is empty. */
  prompt?: string
  /** TTS script. Preferred over prompt for speech models. */
  text?: string
  lyrics?: string
  voiceId?: string
  speed?: number
  vol?: number
  pitch?: number
  emotion?: string
  instrumental?: boolean
  lyricsOptimizer?: boolean
  signal?: AbortSignal
}

interface BackendAudioResponse {
  created: number
  model?: string
  task?: 'tts' | 'music'
  data?: { url?: string }[]
  url?: string
  billing?: BillingPayload
}

function audioHistoryPrompt(options: AudioGenerateOptions) {
  return [options.text, options.prompt, options.lyrics]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join('\n')
}

function audioErrorMessage(error: unknown) {
  if (isCanceledError(error) || (error instanceof Error && error.name === 'AbortError')) return '已取消'
  if (error instanceof Error && error.message) return formatAiError(error.message, '生成失败')
  return '生成失败'
}

/**
 * POST /ai/audios/generations. Returns a stored audio URL the canvas can put on an audio node.
 * There is no SFX model; pass only live speech or music ids.
 */
export const audioService = {
  async generate(options: AudioGenerateOptions): Promise<string> {
    const prompt = audioHistoryPrompt(options)
    const historyId = useGenerationHistoryStore.getState().start({
      mediaType: 'audio',
      prompt,
      title: titleFromPrompt(prompt, '音频生成'),
      source: 'audio',
    })
    try {
      const resp = await withIdempotentGenerate((idempotencyKey) =>
        requestData<BackendAudioResponse>(appClient, {
          url: '/ai/audios/generations',
          method: 'POST',
          signal: options.signal,
          headers: { 'Idempotency-Key': idempotencyKey },
          data: {
            model: options.model,
            prompt: options.prompt,
            text: options.text,
            lyrics: options.lyrics,
            voiceId: options.voiceId,
            speed: options.speed,
            vol: options.vol,
            pitch: options.pitch,
            emotion: options.emotion,
            instrumental: options.instrumental,
            lyricsOptimizer: options.lyricsOptimizer,
            projectId: resolveProjectId(),
            n: 1,
          },
        })
      )
      applyBillingPayload(resp.billing)
      const url = resp.url || resp.data?.map((item) => item.url).find((item): item is string => Boolean(item))
      if (!url) throw new Error('生成成功但未返回音频')
      useGenerationHistoryStore.getState().succeed(historyId, url)
      return url
    } catch (error) {
      useGenerationHistoryStore.getState().fail(historyId, audioErrorMessage(error))
      throw error
    }
  },
}
