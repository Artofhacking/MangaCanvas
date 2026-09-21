/** Modality suffixes that must not appear in picker labels. Longest first. */
const MODALITY_SUFFIX =
  /参考图生视频|文生视频|图生视频|文生图|图生图|生视频|生图/g

/**
 * Display-only model title for pickers.
 * Strips 文生图 / 图生图 / 文生视频 / 图生视频 / 生图 / 生视频.
 * Keeps Pro / Fast / Max / Flare / Sunburst and the API id untouched.
 */
export function displayModelName(name: string | undefined | null): string {
  const raw = String(name || '').trim()
  if (!raw) return ''
  const cleaned = raw.replace(MODALITY_SUFFIX, ' ').replace(/\s+/g, ' ').trim()
  return cleaned || raw
}
