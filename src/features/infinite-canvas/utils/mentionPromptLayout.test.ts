import { describe, expect, it } from 'vitest'
import { fitMentionPromptHeight, syncOverlayScroll } from './mentionPromptLayout'

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
