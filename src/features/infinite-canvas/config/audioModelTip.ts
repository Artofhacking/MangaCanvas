/**
 * Display-only tips for the audio model picker.
 * Match live `/ai/models?modality=audio` keys and labels.
 * MiniMax has no SFX catalog, so sound-effect rows stay empty ('').
 * This copy must not affect generation routing.
 */

export const MINIMAX_TTS_TIP = '海螺 MiniMax 语音合成，把台词转成可下载配音'

export const MINIMAX_MUSIC_TIP =
  '海螺 MiniMax 音乐生成。2026-08-20 起新账号可能无法调用，仍受 minimax_enabled 控制'

interface AudioModelFamily {
  tip: string
  key: (normalizedKey: string) => boolean
  label: (normalizedLabel: string) => boolean
}

function normalizeKey(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
}

function normalizeLabel(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase()
}

function startsWithFamily(key: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => key === prefix || key.startsWith(prefix))
}

const AUDIO_MODEL_FAMILIES: readonly AudioModelFamily[] = [
  {
    tip: MINIMAX_TTS_TIP,
    key: (key) => startsWithFamily(key, ['speech-']),
    label: (label) => label.includes('配音') || label.includes('语音'),
  },
  {
    tip: MINIMAX_MUSIC_TIP,
    key: (key) => startsWithFamily(key, ['music-']),
    label: (label) => label.includes('音乐') && !label.includes('配音'),
  },
]

/**
 * Resolve a short user tip for a live audio model.
 * Key match wins over the label. Unknown families, including SFX, return ''.
 */
export function audioModelTip(key?: string | null, label?: string | null): string {
  const normalizedKey = normalizeKey(key)
  const normalizedLabel = normalizeLabel(label)
  if (!normalizedKey && !normalizedLabel) return ''

  const byKey = normalizedKey
    ? AUDIO_MODEL_FAMILIES.find((family) => family.key(normalizedKey))
    : undefined
  if (byKey) return byKey.tip

  const byLabel = normalizedLabel
    ? AUDIO_MODEL_FAMILIES.find((family) => family.label(normalizedLabel))
    : undefined
  return byLabel?.tip ?? ''
}
