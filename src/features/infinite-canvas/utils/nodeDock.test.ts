import { describe, expect, it } from 'vitest'
import { isGenerateNodeType } from './generateSlots'
import {
  computeNodeDockPosition,
  exactlySelectedNodeId,
  isTextNoteType,
} from './nodeDock'

describe('exactlySelectedNodeId', () => {
  const nodes = [
    { id: 't1', type: 'text', selected: true },
    { id: 'i1', type: 'imageConfig', selected: false },
  ]

  it('returns a text note only when exactly one text node is selected', () => {
    expect(exactlySelectedNodeId(nodes, isTextNoteType)).toBe('t1')
    expect(exactlySelectedNodeId(nodes, isGenerateNodeType)).toBe(null)
  })

  it('hides chrome when multiple text nodes are selected', () => {
    expect(
      exactlySelectedNodeId(
        [
          { id: 't1', type: 'text', selected: true },
          { id: 't2', type: 'text', selected: true },
        ],
        isTextNoteType
      )
    ).toBe(null)
  })

  it('does not treat text as a generate entry', () => {
    expect(isGenerateNodeType('text')).toBe(false)
    expect(isTextNoteType('text')).toBe(true)
    expect(isTextNoteType('imageConfig')).toBe(false)
  })
})

describe('computeNodeDockPosition', () => {
  const barSize = { width: 560, height: 176 }

  it('docks under the card when there is room below', () => {
    const pos = computeNodeDockPosition(
      { id: 'n1', left: 400, top: 80, width: 300, height: 240 },
      barSize,
      { width: 1280, height: 800 }
    )
    expect(pos.placeAbove).toBe(false)
    expect(pos.top).toBe(80 + 240 + 6)
    expect(pos.left).toBe(400 + 150 - 280)
  })

  it('flips above when the bar would clip badly below', () => {
    const pos = computeNodeDockPosition(
      { id: 'n1', left: 400, top: 620, width: 300, height: 240 },
      barSize,
      { width: 1280, height: 800 }
    )
    expect(pos.placeAbove).toBe(true)
    expect(pos.top).toBe(620 - 176 - 6)
  })
})
