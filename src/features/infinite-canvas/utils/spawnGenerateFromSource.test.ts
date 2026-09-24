import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from '../stores/canvasStore'
import { collectGenerateInputs, getIncomingReferenceSlots, isGenerateNodeType } from './generateSlots'
import { resolveMentionsForSend } from './promptMentions'
import { spawnGenerateFromSource, spawnTextNoteFromSource } from './spawnGenerateFromSource'
import { clearTextEditFocus, consumePendingTextEditFocus, getTextEditNodeId } from './textEditFocus'

describe('spawnGenerateFromSource', () => {
  beforeEach(() => {
    clearTextEditFocus()
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

  it('creates a linked text note from the source without a generate node', () => {
    const sourceId = useCanvasStore.getState().addNode('image', { x: 0, y: 0 }, {
      url: 'https://example.com/ref.png',
      label: '图片节点',
    })

    const id = spawnTextNoteFromSource(sourceId, { x: 320, y: 80 })
    expect(id).toBeTruthy()

    const { nodes, edges } = useCanvasStore.getState()
    const spawned = nodes.find((node) => node.id === id)
    expect(spawned?.type).toBe('text')
    expect(spawned?.data.label).toBe('文本')
    expect(spawned?.data.content).toBe('')
    expect(spawned?.selected).toBe(true)
    expect(isGenerateNodeType(spawned?.type)).toBe(false)
    expect(nodes.filter((node) => isGenerateNodeType(node.type))).toHaveLength(0)
    expect(edges).toEqual([
      expect.objectContaining({
        source: sourceId,
        target: id,
        targetHandle: 'left',
      }),
    ])
    expect(getTextEditNodeId()).toBe(id)
    expect(consumePendingTextEditFocus(id!)).toBe(true)
  })

  it('does not spawn a text note when the source is missing', () => {
    expect(spawnTextNoteFromSource('missing', { x: 0, y: 0 })).toBeNull()
    expect(useCanvasStore.getState().nodes).toHaveLength(0)
  })

  it('creates a 文本 note that is not a generation entry', () => {
    const id = useCanvasStore.getState().addNode('text', { x: 0, y: 0 })
    const node = useCanvasStore.getState().nodes.find((item) => item.id === id)

    expect(node?.type).toBe('text')
    expect(node?.data.label).toBe('文本')
    expect(node?.data.content).toBe('')
    expect(isGenerateNodeType(node?.type)).toBe(false)
  })

  it('persists note content without turning a selected text node into a generate entry', () => {
    const id = useCanvasStore.getState().addNode('text', { x: 0, y: 0 })
    useCanvasStore.getState().selectNode(id)
    useCanvasStore.getState().updateNode(id, { content: '屋顶上的旁白' })

    const { nodes } = useCanvasStore.getState()
    const selected = nodes.filter((item) => item.selected)
    expect(selected).toHaveLength(1)
    expect(selected[0]?.id).toBe(id)
    expect(selected[0]?.data.content).toBe('屋顶上的旁白')
    expect(isGenerateNodeType(selected[0]?.type)).toBe(false)
  })

  it('wires a text note into a 画面 node as a text reference slot', () => {
    const textId = useCanvasStore.getState().addNode('text', { x: 0, y: 0 }, {
      content: '夜色里的旁白',
    })
    const imageId = useCanvasStore.getState().addNode('imageConfig', { x: 320, y: 0 })

    useCanvasStore.getState().onConnect({
      source: textId,
      target: imageId,
      sourceHandle: 'right',
      targetHandle: 'left',
    })

    const { nodes, edges } = useCanvasStore.getState()
    expect(edges.some((edge) => edge.source === textId && edge.target === imageId)).toBe(true)

    const slots = getIncomingReferenceSlots(imageId, nodes, edges)
    expect(slots).toHaveLength(1)
    expect(slots[0]).toMatchObject({
      kind: 'text',
      sourceId: textId,
      snippet: '夜色里的旁白',
    })
    expect(isGenerateNodeType(nodes.find((node) => node.id === textId)?.type)).toBe(false)
  })

  it('accepts incoming edges onto a text note', () => {
    const imageId = useCanvasStore.getState().addNode('image', { x: 0, y: 0 }, {
      url: 'https://example.com/ref.png',
    })
    const textId = useCanvasStore.getState().addNode('text', { x: 320, y: 0 })

    useCanvasStore.getState().onConnect({
      source: imageId,
      target: textId,
      sourceHandle: 'right',
      targetHandle: 'left',
    })

    const { edges } = useCanvasStore.getState()
    expect(edges.some((edge) => edge.source === imageId && edge.target === textId)).toBe(true)
  })
})
