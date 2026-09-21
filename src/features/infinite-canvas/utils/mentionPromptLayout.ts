export const MENTION_PROMPT_MIN_HEIGHT = 120

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
