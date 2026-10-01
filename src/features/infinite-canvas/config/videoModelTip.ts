/**
 * Display-only tips for the video model picker.
 * Match live `/ai/models` keys and labels by family. Do not list every
 * t2v / i2v / r2v id — the picker already collapses those to one row.
 * Unknown families return '' so the menu can omit the subtitle line.
 * This copy must not affect generation routing.
 */

export const HAPPYHORSE_VIDEO_TIP =
  '阿里云最新模型，支持文生视频、首帧生成视频；多参考图走参考生视频'

export const SEEDANCE_VIDEO_TIP = '字节 Seedance 视频模型，支持文生与图生视频'

export const MINIMAX_VIDEO_TIP = '海螺 MiniMax 视频模型，支持文生与图生视频'

export const VIDU_VIDEO_TIP = 'Vidu 视频模型，支持文生与图生视频'

interface VideoModelFamily {
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

const VIDEO_MODEL_FAMILIES: readonly VideoModelFamily[] = [
  {
    tip: HAPPYHORSE_VIDEO_TIP,
    key: (key) => startsWithFamily(key, ['happyhorse', 'happy-horse']),
    label: (label) =>
      label.includes('happyhorse') || label.includes('happy-horse') || label.includes('happy horse'),
  },
  {
    tip: SEEDANCE_VIDEO_TIP,
    key: (key) =>
      startsWithFamily(key, ['doubao-seedance', 'seedance', 'seeddance']) || key.includes('seedance'),
    label: (label) => label.includes('seedance'),
  },
  {
    tip: MINIMAX_VIDEO_TIP,
    key: (key) => startsWithFamily(key, ['minimax', 'hailuo']) || key.includes('minimax'),
    label: (label) => label.includes('minimax') || label.includes('海螺') || label.includes('hailuo'),
  },
  {
    tip: VIDU_VIDEO_TIP,
    key: (key) => startsWithFamily(key, ['vidu']),
    label: (label) => label.includes('vidu'),
  },
]

/**
 * Resolve a short user tip for a live video model.
 * Key match wins over the label, so a routed id is not relabeled by display text.
 */
export function videoModelTip(key?: string | null, label?: string | null): string {
  const normalizedKey = normalizeKey(key)
  const normalizedLabel = normalizeLabel(label)
  if (!normalizedKey && !normalizedLabel) return ''
  // Standalone TTS / music ids share the MiniMax account but are not Hailuo video.
  if (normalizedKey.startsWith('speech-') || normalizedKey.startsWith('music-')) return ''

  const byKey = normalizedKey
    ? VIDEO_MODEL_FAMILIES.find((family) => family.key(normalizedKey))
    : undefined
  if (byKey) return byKey.tip

  const byLabel = normalizedLabel
    ? VIDEO_MODEL_FAMILIES.find((family) => family.label(normalizedLabel))
    : undefined
  return byLabel?.tip ?? ''
}
