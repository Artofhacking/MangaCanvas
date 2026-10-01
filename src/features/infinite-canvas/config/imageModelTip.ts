/**
 * Display-only tips for the image model picker.
 * One row per live `/ai/models` id (unlike video, which collapses families).
 * More specific ids are listed first so `*-pro` and GPT Image 2.5 are not
 * swallowed by a shorter prefix. A hyphen suffix still counts as the same
 * model, so a future patch id keeps the tip without a new hard-coded row.
 * Unknown models return '' so the menu can omit the subtitle line.
 * This copy must not affect generation routing.
 */

export const GPT_IMAGE_2_TIP = 'OpenAI 文生图；低/中/高画质；可挂参考图做编辑'

export const GPT_IMAGE_2_5_TIP = 'OpenAI GPT Image 2.5；低/中/高画质；可挂参考图做编辑'

export const WAN_2_7_IMAGE_TIP = '阿里万相 2.7 文生图；可挂参考图'

export const WAN_2_7_IMAGE_PRO_TIP = '阿里万相 2.7 Pro，更高质文生图；可挂参考图'

export const WAN_2_6_T2I_TIP = '阿里万相 2.6 文生图；不支持参考图'

export const QWEN_IMAGE_2_TIP = '通义千问文生图；不支持参考图'

export const QWEN_IMAGE_2_PRO_TIP = '通义千问 Pro，更高质文生图；不支持参考图'

export const WAN_2_6_IMAGE_TIP = '阿里万相 2.6 图生图；需上传参考图'

interface ImageModelTipRule {
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

/** Exact id, or the same id plus a hyphenated patch / variant suffix. */
function matchesId(key: string, base: string): boolean {
  return key === base || key.startsWith(`${base}-`)
}

function hasProMark(label: string): boolean {
  return /(?:^|[^a-z0-9])pro(?:[^a-z0-9]|$)/.test(label)
}

function mentionsWan(label: string): boolean {
  return label.includes('万相') || label.includes('wan')
}

function isGptImage25Key(key: string): boolean {
  return (
    key === 'gpt-image-2.5' ||
    key.startsWith('gpt-image-2.5') ||
    key === 'gpt-image-2-5' ||
    key.startsWith('gpt-image-2-5-')
  )
}

function isGptImage25Label(label: string): boolean {
  return /gpt[\s-]*image[\s-]*2[.\-]5/.test(label)
}

function isGptImage2Label(label: string): boolean {
  if (isGptImage25Label(label)) return false
  return /gpt[\s-]*image[\s-]*2(?!\.\d)(?!\d)/.test(label)
}

function isQwenImageLabel(label: string): boolean {
  if (/qwen[\s-]*image[\s-]*2\.0/.test(label) || label.includes('qwen-image-2.0')) return true
  if (!label.includes('通义千问')) return false
  if (!label.includes('生图') && !label.includes('文生图')) return false
  return !/[0-9]/.test(label) || label.includes('2.0')
}

const IMAGE_MODEL_TIPS: readonly ImageModelTipRule[] = [
  {
    tip: GPT_IMAGE_2_5_TIP,
    key: isGptImage25Key,
    label: isGptImage25Label,
  },
  {
    tip: GPT_IMAGE_2_TIP,
    key: (key) => !isGptImage25Key(key) && matchesId(key, 'gpt-image-2'),
    label: isGptImage2Label,
  },
  {
    tip: WAN_2_7_IMAGE_PRO_TIP,
    key: (key) => matchesId(key, 'wan2.7-image-pro'),
    label: (label) => mentionsWan(label) && label.includes('2.7') && hasProMark(label),
  },
  {
    tip: WAN_2_7_IMAGE_TIP,
    key: (key) => !matchesId(key, 'wan2.7-image-pro') && matchesId(key, 'wan2.7-image'),
    label: (label) => mentionsWan(label) && label.includes('2.7') && !hasProMark(label),
  },
  {
    tip: WAN_2_6_T2I_TIP,
    key: (key) => matchesId(key, 'wan2.6-t2i'),
    label: (label) =>
      mentionsWan(label) &&
      label.includes('2.6') &&
      !label.includes('图生图') &&
      (label.includes('文生图') || label.includes('t2i') || label.includes('text-to-image')),
  },
  {
    tip: QWEN_IMAGE_2_PRO_TIP,
    key: (key) => matchesId(key, 'qwen-image-2.0-pro'),
    label: (label) => isQwenImageLabel(label) && hasProMark(label),
  },
  {
    tip: QWEN_IMAGE_2_TIP,
    key: (key) => !matchesId(key, 'qwen-image-2.0-pro') && matchesId(key, 'qwen-image-2.0'),
    label: (label) => isQwenImageLabel(label) && !hasProMark(label),
  },
  {
    tip: WAN_2_6_IMAGE_TIP,
    key: (key) => matchesId(key, 'wan2.6-image'),
    label: (label) =>
      mentionsWan(label) &&
      label.includes('2.6') &&
      (label.includes('图生图') || label.includes('i2i') || label.includes('wan2.6-image')),
  },
]

/**
 * Resolve a short user tip for a live image model.
 * Key match wins over the label, so a routed id is not relabeled by display text.
 */
export function imageModelTip(key?: string | null, label?: string | null): string {
  const normalizedKey = normalizeKey(key)
  const normalizedLabel = normalizeLabel(label)
  if (!normalizedKey && !normalizedLabel) return ''

  const byKey = normalizedKey ? IMAGE_MODEL_TIPS.find((rule) => rule.key(normalizedKey)) : undefined
  if (byKey) return byKey.tip

  const byLabel = normalizedLabel
    ? IMAGE_MODEL_TIPS.find((rule) => rule.label(normalizedLabel))
    : undefined
  return byLabel?.tip ?? ''
}
