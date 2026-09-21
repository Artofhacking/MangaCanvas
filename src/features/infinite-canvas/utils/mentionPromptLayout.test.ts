import { describe, expect, it } from 'vitest'
import {
  fitMentionPromptHeight,
  MENTION_PROMPT_FIELD_CLASS,
  MENTION_PROMPT_OVERLAY_SCROLL_CLASS,
  MENTION_PROMPT_TEXTAREA_SCROLL_CLASS,
  MENTION_TOKEN_BROKEN_CLASS,
  MENTION_TOKEN_MARK_CLASS,
  MENTION_TOKEN_OK_CLASS,
  mentionTokenShiftsLayout,
  syncOverlayScroll,
} from './mentionPromptLayout'

describe('fitMentionPromptHeight', () => {
  it('keeps the min height when content is shorter', () => {
    const el = { style: { height: '' }, scrollHeight: 64 }
    expect(fitMentionPromptHeight(el, 120)).toBe(120)
    expect(el.style.height).toBe('120px')
  })

  it('grows to the content height so a later CSS max-height can scroll', () => {
    const el = { style: { height: '120px' }, scrollHeight: 480 }
    expect(fitMentionPromptHeight(el, 120)).toBe(480)
    expect(el.style.height).toBe('480px')
  })

  it('measures against height:auto before applying the next height', () => {
    const heights: string[] = []
    const el = {
      style: {
        height: '120px',
      },
      get scrollHeight() {
        heights.push(this.style.height)
        return this.style.height === 'auto' ? 200 : 8
      },
    }
    expect(fitMentionPromptHeight(el, 120)).toBe(200)
    expect(heights[0]).toBe('auto')
    expect(el.style.height).toBe('200px')
  })
})

describe('syncOverlayScroll', () => {
  it('copies scrollTop and scrollLeft onto the highlight overlay', () => {
    const overlay = { scrollTop: 0, scrollLeft: 0 }
    syncOverlayScroll({ scrollTop: 42, scrollLeft: 7 }, overlay)
    expect(overlay).toEqual({ scrollTop: 42, scrollLeft: 7 })
  })
})

describe('mention prompt field metrics', () => {
  it('resets inherited cn-keep wrap so overlay and textarea share CJK line breaks', () => {
    expect(MENTION_PROMPT_FIELD_CLASS).toContain('[word-break:normal]')
    expect(MENTION_PROMPT_FIELD_CLASS).toContain('[line-break:auto]')
    expect(MENTION_PROMPT_FIELD_CLASS).toContain('[overflow-wrap:break-word]')
    expect(MENTION_PROMPT_FIELD_CLASS).toContain('whitespace-pre-wrap')
    expect(MENTION_PROMPT_FIELD_CLASS).toContain('leading-5')
    expect(MENTION_PROMPT_FIELD_CLASS).toContain('px-3')
    expect(MENTION_PROMPT_FIELD_CLASS).toContain('py-2.5')
    expect(MENTION_PROMPT_FIELD_CLASS).toContain('[font-family:inherit]')
    expect(MENTION_PROMPT_FIELD_CLASS).toContain('[scrollbar-gutter:stable]')
  })

  it('keeps overlay and textarea on the same scroll + gutter model', () => {
    expect(MENTION_PROMPT_OVERLAY_SCROLL_CLASS).toContain('overflow-y-auto')
    expect(MENTION_PROMPT_TEXTAREA_SCROLL_CLASS).toContain('overflow-y-auto')
    expect(MENTION_PROMPT_FIELD_CLASS).toContain('[scrollbar-gutter:stable]')
  })

  it('paints mention marks without padding or weight that changes wrap width', () => {
    const mark = `${MENTION_TOKEN_MARK_CLASS} ${MENTION_TOKEN_OK_CLASS}`
    const broken = `${MENTION_TOKEN_MARK_CLASS} ${MENTION_TOKEN_BROKEN_CLASS}`
    expect(mentionTokenShiftsLayout(mark)).toBe(false)
    expect(mentionTokenShiftsLayout(broken)).toBe(false)
    expect(mentionTokenShiftsLayout('rounded-md px-0.5 font-semibold')).toBe(true)
    expect(mentionTokenShiftsLayout('mx-0.5 font-bold')).toBe(true)
  })
})
