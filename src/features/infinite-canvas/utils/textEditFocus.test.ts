import { describe, expect, it } from 'vitest'
import {
  consumePendingTextEditFocus,
  requestTextEditFocus,
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
  })
})
