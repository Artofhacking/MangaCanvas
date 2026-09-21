import { describe, expect, it } from 'vitest'
import { reconcilePromptMentions, type SlotRef } from './promptMentions'
import type { ReferenceSlot } from './generateSlots'

function slot(index: number, sourceId: string, dead = false): ReferenceSlot {
  return {
    index,
    edgeId: `edge_${sourceId}`,
    sourceId,
    kind: 'image',
    label: `参考 ${index}`,
    dead,
  }
}

describe('reconcilePromptMentions', () => {
  it('does not invent @n tokens into an empty prompt when slots appear', () => {
    const previous: SlotRef[] = []
    const next = [slot(1, 'src_a')]
    expect(reconcilePromptMentions('', previous, next)).toBe('')
    expect(reconcilePromptMentions('   ', previous, next)).toBe('   ')
  })

  it('does not invent mentions when an empty prompt already has previous slots', () => {
    const previous: SlotRef[] = [{ index: 1, sourceId: 'src_a' }]
    const next = [slot(1, 'src_a'), slot(2, 'src_b')]
    expect(reconcilePromptMentions('', previous, next)).toBe('')
  })

  it('remaps existing mentions when incoming slots reorder', () => {
    const previous: SlotRef[] = [
      { index: 1, sourceId: 'src_a' },
      { index: 2, sourceId: 'src_b' },
    ]
    const next = [slot(1, 'src_b'), slot(2, 'src_a')]
    expect(reconcilePromptMentions('keep @1 then @2', previous, next)).toBe('keep @2 then @1')
  })

  it('marks mentions as broken when their source disconnects', () => {
    const previous: SlotRef[] = [{ index: 1, sourceId: 'src_a' }]
    const next = [slot(1, 'src_b')]
    expect(reconcilePromptMentions('use @1 here', previous, next)).toBe('use @? here')
  })
})
