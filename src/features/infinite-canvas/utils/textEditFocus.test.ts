import { describe, expect, it } from 'vitest'
import {
  clearTextEditFocus,
  consumePendingTextEditFocus,
  getTextEditNodeId,
  requestTextEditFocus,
  resolveTextEditTarget,
  subscribeTextEditFocus,
} from './textEditFocus'

describe('textEditFocus', () => {
  it('notifies listeners and keeps a pending id until consumed', () => {
    const seen: string[] = []
    const unsubscribe = subscribeTextEditFocus((nodeId) => seen.push(nodeId))

    requestTextEditFocus('node_1')
    expect(seen).toEqual(['node_1'])
    expect(consumePendingTextEditFocus('node_other')).toBe(false)
    expect(consumePendingTextEditFocus('node_1')).toBe(true)
    expect(consumePendingTextEditFocus('node_1')).toBe(false)

    unsubscribe()
    requestTextEditFocus('node_2')
    expect(seen).toEqual(['node_1'])
    clearTextEditFocus()
  })

  it('keeps the edit bar closed until that text node is explicitly opened', () => {
    clearTextEditFocus()
    expect(resolveTextEditTarget('act_11', null)).toBeNull()
    expect(resolveTextEditTarget('act_11', 'act_3')).toBeNull()

    requestTextEditFocus('act_11')
    expect(getTextEditNodeId()).toBe('act_11')
    expect(resolveTextEditTarget('act_11', getTextEditNodeId())).toBe('act_11')
    expect(resolveTextEditTarget('text_2', getTextEditNodeId())).toBeNull()

    clearTextEditFocus('act_3')
    expect(getTextEditNodeId()).toBe('act_11')
    clearTextEditFocus('act_11')
    expect(getTextEditNodeId()).toBeNull()
    expect(resolveTextEditTarget('act_11', getTextEditNodeId())).toBeNull()
  })
})
