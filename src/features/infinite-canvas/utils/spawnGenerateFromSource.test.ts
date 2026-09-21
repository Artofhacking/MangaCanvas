import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from '../stores/canvasStore'
import { collectGenerateInputs, getIncomingReferenceSlots, isGenerateNodeType } from './generateSlots'
import { resolveMentionsForSend } from './promptMentions'
import { spawnGenerateFromSource } from './spawnGenerateFromSource'

describe('spawnGenerateFromSource', () => {
  beforeEach(() => {
    useCanvasStore.getState().clearCanvas()
  })

  it('wires the reference slot without seeding @1 into an empty prompt', () => {
    const sourceId = useCanvasStore.getState().addNode('image', { x: 0, y: 0 }, {
      url: 'https://example.com/ref.png',
      label: '图片节点',
    })

    const id = spawnGenerateFromSource(sourceId, 'imageConfig', { x: 320, y: 80 })
    expect(id).toBeTruthy()

    const { nodes, edges } = useCanvasStore.getState()
    const spawned = nodes.find((node) => node.id === id)
    expect(spawned?.data.prompt).toBe('')
    expect(spawned?.data.prompt).not.toMatch(/@\d/)
    expect(edges.some((edge) => edge.source === sourceId && edge.target === id)).toBe(true)

    const slots = getIncomingReferenceSlots(id!, nodes, edges)
    expect(slots).toHaveLength(1)
    expect(slots[0]).toMatchObject({ index: 1, sourceId })
  })

  it('does not write @n when connecting an existing empty 画面节点', () => {
    const sourceId = useCanvasStore.getState().addNode('image', { x: 0, y: 0 })
    const targetId = useCanvasStore.getState().addNode('imageConfig', { x: 320, y: 80 })

    useCanvasStore.getState().addEdgeManually({ source: sourceId, target: targetId })

    const { nodes, edges } = useCanvasStore.getState()
    const target = nodes.find((node) => node.id === targetId)
    expect(target?.data.prompt).toBe('')
    expect(getIncomingReferenceSlots(targetId, nodes, edges)).toHaveLength(1)
  })

  it('still resolves a manually typed @1 against the connected slot', () => {
    const sourceId = useCanvasStore.getState().addNode('image', { x: 0, y: 0 }, {
      url: 'https://example.com/ref.png',
    })
    const id = spawnGenerateFromSource(sourceId, 'imageConfig', { x: 320, y: 80 })
    const { nodes, edges } = useCanvasStore.getState()
    const slots = getIncomingReferenceSlots(id!, nodes, edges)
    const resolved = resolveMentionsForSend('keep lighting @1', slots)
    const inputs = collectGenerateInputs(id!, nodes, edges, {
      localPrompt: resolved,
      promptSource: 'bar',
    })

    expect(resolved).toBe('keep lighting @1')
    expect(inputs.prompt).toBe('keep lighting @1')
    expect(inputs.refImages).toEqual(['https://example.com/ref.png'])
  })

  it('creates a 文本 note that is not a generation entry', () => {
    const id = useCanvasStore.getState().addNode('text', { x: 0, y: 0 })
    const node = useCanvasStore.getState().nodes.find((item) => item.id === id)

    expect(node?.type).toBe('text')
    expect(node?.data.label).toBe('文本')
    expect(node?.data.content).toBe('')
    expect(isGenerateNodeType(node?.type)).toBe(false)
  })
})
