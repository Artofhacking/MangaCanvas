export const MENTION_PROMPT_MIN_HEIGHT = 120

/**
 * Shared box + typography metrics for the transparent textarea and the
 * highlight overlay. Both layers must measure identical wrap width so the
 * caret stays on the visible glyphs — especially after long CJK prompts.
 *
 * Canvas root uses `.cn-keep` (`word-break: keep-all` + `line-break: strict`).
 * That inheritance must be reset here: a DIV overlay honors those rules, a
 * textarea typically does not, which is the wrap desync.
 */
export const MENTION_PROMPT_FIELD_CLASS = [
  'box-border',
  'whitespace-pre-wrap',
  'break-words',
  '[overflow-wrap:break-word]',
  '[word-break:normal]',
  '[line-break:auto]',
  'px-3',
  'py-2.5',
  'text-sm',
  'font-normal',
  'leading-5',
  'tracking-normal',
  '[font-family:inherit]',
  '[font-feature-settings:inherit]',
  '[tab-size:4]',
  '[scrollbar-gutter:stable]',
].join(' ')

/** Overlay scrolls with the textarea but must not paint a second scrollbar. */
export const MENTION_PROMPT_OVERLAY_SCROLL_CLASS = [
  'overflow-y-auto',
  'overflow-x-hidden',
  'overscroll-contain',
  '[&::-webkit-scrollbar-thumb]:bg-transparent',
  '[&::-webkit-scrollbar-track]:bg-transparent',
].join(' ')

export const MENTION_PROMPT_TEXTAREA_SCROLL_CLASS =
  'overflow-y-auto overflow-x-hidden overscroll-contain'

/**
 * Mention highlight paint only. Horizontal padding or font-weight would
 * change the measured run width vs the textarea's plain text.
 */
export const MENTION_TOKEN_MARK_CLASS = [
  'rounded-sm',
  '[box-decoration-break:clone]',
  '[-webkit-box-decoration-break:clone]',
].join(' ')

export const MENTION_TOKEN_OK_CLASS =
  'bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))]'

export const MENTION_TOKEN_BROKEN_CLASS = 'bg-red-500/15 text-red-600'

const LAYOUT_SHIFTING_TOKEN_CLASS =
  /(?:^|\s)(?:p[xytrbl]?-\S+|m[xytrbl]?-\S+|font-(?:thin|extralight|light|medium|semibold|bold|extrabold|black))(?:\s|$)/

export function mentionTokenShiftsLayout(className: string): boolean {
  return LAYOUT_SHIFTING_TOKEN_CLASS.test(className)
}

export function fitMentionPromptHeight(
  el: { style: { height: string }; scrollHeight: number },
  minHeight = MENTION_PROMPT_MIN_HEIGHT
): number {
  el.style.height = 'auto'
  const height = Math.max(minHeight, el.scrollHeight)
  el.style.height = `${height}px`
  return height
}

export function syncOverlayScroll(
  source: { scrollTop: number; scrollLeft: number },
  overlay: { scrollTop: number; scrollLeft: number }
): void {
  overlay.scrollTop = source.scrollTop
  overlay.scrollLeft = source.scrollLeft
}
