import { beforeEach, describe, expect, it } from 'vitest'
import { UNSUPPORTED_REFERENCE_IMAGE_MESSAGE } from '@/api/aigc'
import { useCanvasStore } from '../stores/canvasStore'
import type { CustomNode } from '../types'
import { collectGenerateInputs, getIncomingReferenceSlots } from './generateSlots'
import { listVideoRequestImages, VIDEO_REFERENCE_LIMIT } from './generateParams'
import {
  applyReferencePickClick,
  assessReferencePick,
  noteReferencePickClick,
  REFERENCE_EMPTY_HINT,
  REFERENCE_PICK_BUTTON_LABEL,
  REFERENCE_PICK_AUDIO_EMPTY_MESSAGE,
  REFERENCE_PICK_AUDIO_TYPE_MESSAGE,
  REFERENCE_PICK_EMPTY_MESSAGE,
  REFERENCE_PICK_SELF_MESSAGE,
  REFERENCE_PICK_TEXT_EMPTY_MESSAGE,
  REFERENCE_PICK_TOOLTIP,
  REFERENCE_PICK_TYPE_MESSAGE,
  REFERENCE_PICK_VIDEO_LIMIT_MESSAGE,
  REFERENCE_PICK_VIDEO_MESSAGE,
  resetReferencePickClickGuard,
  withReferencePickClasses,
} from './referencePick'

function node(partial: Partial<CustomNode> & Pick<CustomNode, 'id' | 'type'>): CustomNode {
  return {
    position: { x: 0, y: 0 },
    ...partial,
    data: { label: partial.id, ...partial.data },
  }
}

describe('reference pick copy', () => {
  it('uses the LibTV entry label and mentions 点选或连线', () => {
    expect(REFERENCE_PICK_BUTTON_LABEL).toBe('+ 参考')
    expect(REFERENCE_PICK_TOOLTIP).toBe('从当前画布中添加参考')
    expect(REFERENCE_EMPTY_HINT).toContain('点选或连线')
    expect(REFERENCE_EMPTY_HINT).not.toBe('连入后编号，输入 @ 可引用')
  })
})

describe('assessReferencePick', () => {
  const image = (id: string, url?: string) =>
    node({ id, type: 'image', data: { label: id, ...(url ? { url } : {}) } })
  const picture = (id: string, url?: string, model = 'gpt-image-2') =>
    node({ id, type: 'imageConfig', data: { label: id, model, ...(url ? { url } : {}) } })
  const video = (id: string) => node({ id, type: 'videoConfig', data: { label: id, model: 'happyhorse-1.1-t2v' } })

  it('marks a filled image as pickable and blocks empty, self, video, and other types', () => {
    const target = picture('gen')
    const source = image('shot', 'https://img/a.png')
    const nodes = [target, source, image('empty'), node({ id: 'clip', type: 'video', data: { label: 'clip', url: 'https://vid' } }), node({ id: 'note', type: 'text', data: { label: 'note', content: '旁白' } })]

    expect(assessReferencePick({ source, target, nodes, edges: [] }).visual).toBe('pickable')
    expect(assessReferencePick({ source: image('empty'), target, nodes, edges: [] })).toMatchObject({
      visual: 'blocked',
      block: 'no-media',
      message: REFERENCE_PICK_EMPTY_MESSAGE,
    })
    expect(assessReferencePick({ source: target, target, nodes, edges: [] })).toMatchObject({
      visual: 'blocked',
      block: 'self',
      message: REFERENCE_PICK_SELF_MESSAGE,
    })
    expect(assessReferencePick({ source: nodes[3], target, nodes, edges: [] })).toMatchObject({
      visual: 'blocked',
      block: 'video',
      message: REFERENCE_PICK_VIDEO_MESSAGE,
    })
    expect(assessReferencePick({ source: nodes[4], target, nodes, edges: [] })).toMatchObject({
      visual: 'blocked',
      block: 'type',
      message: REFERENCE_PICK_TYPE_MESSAGE,
    })
  })

  it('keeps an already connected source disconnectable, including a video that was dragged in', () => {
    const target = video('gen')
    const source = node({ id: 'clip', type: 'video', data: { label: 'clip', url: 'https://vid' } })
    const edges = [{ id: 'e1', source: 'clip', target: 'gen' }]
    expect(assessReferencePick({ source, target, nodes: [target, source], edges }).visual).toBe('connected')
  })

  it('blocks the image that video send would drop past the hard limit', () => {
    const target = video('gen')
    const sources = [1, 2, 3, 4].map((index) => image(`s${index}`, `https://img/${index}.png`))
    const edges = sources.slice(0, 3).map((source, index) => ({
      id: `e${index}`,
      source: source.id,
      target: 'gen',
      data: { slotOrder: index + 1 },
    }))
    const nodes = [target, ...sources]
    expect(assessReferencePick({ source: sources[3], target, nodes, edges })).toMatchObject({
      visual: 'blocked',
      block: 'limit',
      message: REFERENCE_PICK_VIDEO_LIMIT_MESSAGE,
    })
    expect(VIDEO_REFERENCE_LIMIT).toBe(3)
  })

  it('still allows a duplicate url once three unique video refs are attached', () => {
    const target = video('gen')
    const sources = [image('a', 'https://img/a.png'), image('b', 'https://img/b.png'), image('c', 'https://img/c.png'), image('a2', 'https://img/a.png')]
    const edges = sources.slice(0, 3).map((source, index) => ({
      id: `e${index}`,
      source: source.id,
      target: 'gen',
      data: { slotOrder: index + 1 },
    }))
    expect(assessReferencePick({ source: sources[3], target, nodes: [target, ...sources], edges }).visual).toBe('pickable')
  })

  it('follows i2i routing: qwen blocks, gpt and switched wan2.6-t2i do not', () => {
    const source = image('shot', 'https://img/a.png')
    const qwen = picture('q', undefined, 'qwen-image-2.0')
    const gpt = picture('g')
    const wan = picture('w', undefined, 'wan2.6-t2i')
    expect(assessReferencePick({ source, target: qwen, nodes: [qwen, source], edges: [] })).toMatchObject({
      visual: 'blocked',
      block: 'limit',
      message: UNSUPPORTED_REFERENCE_IMAGE_MESSAGE,
    })
    expect(assessReferencePick({ source, target: gpt, nodes: [gpt, source], edges: [] }).visual).toBe('pickable')
    expect(assessReferencePick({ source, target: wan, nodes: [wan, source], edges: [], liveImageModelIds: [] }).visual).toBe('pickable')
    expect(assessReferencePick({
      source,
      target: wan,
      nodes: [wan, source],
      edges: [],
      liveImageModelIds: ['wan2.6-t2i'],
    }).visual).toBe('blocked')
  })

  it('does not invent a numeric cap for i2i image models', () => {
    const target = picture('gen')
    const sources = [1, 2, 3, 4].map((index) => image(`s${index}`, `https://img/${index}.png`))
    const edges = sources.slice(0, 3).map((source, index) => ({
      id: `e${index}`,
      source: source.id,
      target: 'gen',
      data: { slotOrder: index + 1 },
    }))
    expect(assessReferencePick({ source: sources[3], target, nodes: [target, ...sources], edges }).visual).toBe('pickable')
  })
})

describe('applyReferencePickClick', () => {
  beforeEach(() => {
    resetReferencePickClickGuard()
    useCanvasStore.getState().clearCanvas()
  })

  it('creates the same edge as drag-connect, including slotOrder and imageRole', () => {
    const sourceId = useCanvasStore.getState().addNode('image', { x: 0, y: 0 }, { url: 'https://img/a.png' })
    const targetId = useCanvasStore.getState().addNode('videoConfig', { x: 320, y: 0 })
    useCanvasStore.getState().setReferencePickTarget(targetId)

    expect(applyReferencePickClick(sourceId)).toEqual({ action: 'added' })

    const picked = useCanvasStore.getState().edges[0]
    useCanvasStore.getState().clearCanvas()
    const dragSource = useCanvasStore.getState().addNode('image', { x: 0, y: 0 }, { url: 'https://img/a.png' })
    const dragTarget = useCanvasStore.getState().addNode('videoConfig', { x: 320, y: 0 })
    useCanvasStore.getState().onConnect({
      source: dragSource,
      target: dragTarget,
      sourceHandle: null,
      targetHandle: null,
    })
    const dragged = useCanvasStore.getState().edges[0]

    expect(picked.type).toBe(dragged.type)
    expect(picked.data).toEqual(dragged.data)
    expect(picked.type).toBe('imageRole')
    expect(picked.data).toMatchObject({ imageRole: 'first_frame_image', slotOrder: 1 })

    const { nodes, edges } = useCanvasStore.getState()
    const inputs = collectGenerateInputs(dragTarget, nodes, edges)
    expect(inputs.refImages).toEqual(['https://img/a.png'])
    expect(getIncomingReferenceSlots(dragTarget, nodes, edges)[0]?.index).toBe(1)
  })

  it('numbers a second image slot and keeps the generate node selected', () => {
    const firstId = useCanvasStore.getState().addNode('image', { x: 0, y: 0 }, { url: 'https://img/a.png' })
    const secondId = useCanvasStore.getState().addNode('imageConfig', { x: 0, y: 200 }, { url: 'https://img/b.png' })
    const targetId = useCanvasStore.getState().addNode('imageConfig', { x: 400, y: 0 })
    useCanvasStore.getState().setReferencePickTarget(targetId)
    applyReferencePickClick(firstId)
    applyReferencePickClick(secondId)

    const { nodes, edges } = useCanvasStore.getState()
    const slots = getIncomingReferenceSlots(targetId, nodes, edges)
    expect(slots.map((slot) => slot.index)).toEqual([1, 2])
    expect(slots.map((slot) => slot.sourceId)).toEqual([firstId, secondId])
    expect(collectGenerateInputs(targetId, nodes, edges).refImages).toEqual([
      'https://img/a.png',
      'https://img/b.png',
    ])
    expect(nodes.find((item) => item.id === targetId)?.selected).toBe(true)
    expect(nodes.find((item) => item.id === secondId)?.selected).toBe(false)
    expect(edges.some((edge) => edge.type === 'imageRole')).toBe(false)
  })

  it('blocks a fourth video reference and leaves the three sendable urls in place', () => {
    const targetId = useCanvasStore.getState().addNode('videoConfig', { x: 400, y: 0 })
    const ids = [1, 2, 3, 4].map((index) =>
      useCanvasStore.getState().addNode('image', { x: 0, y: index * 40 }, { url: `https://img/${index}.png` })
    )
    useCanvasStore.getState().setReferencePickTarget(targetId)
    ids.slice(0, 3).forEach((id) => expect(applyReferencePickClick(id).action).toBe('added'))
    expect(applyReferencePickClick(ids[3])).toEqual({
      action: 'blocked',
      message: REFERENCE_PICK_VIDEO_LIMIT_MESSAGE,
    })

    const { nodes, edges } = useCanvasStore.getState()
    const inputs = collectGenerateInputs(targetId, nodes, edges)
    expect(listVideoRequestImages(inputs.firstFrameImage, inputs.refImages)).toEqual([
      'https://img/1.png',
      'https://img/2.png',
      'https://img/3.png',
    ])
    expect(edges.filter((edge) => edge.target === targetId)).toHaveLength(3)
  })

  it('disconnects an already connected source and can undo that removal', () => {
    const sourceId = useCanvasStore.getState().addNode('image', { x: 0, y: 0 }, { url: 'https://img/a.png' })
    const targetId = useCanvasStore.getState().addNode('imageConfig', { x: 320, y: 0 })
    useCanvasStore.getState().setReferencePickTarget(targetId)
    applyReferencePickClick(sourceId)
    expect(applyReferencePickClick(sourceId)).toEqual({ action: 'removed' })
    expect(useCanvasStore.getState().edges).toHaveLength(0)

    useCanvasStore.getState().undo()
    expect(useCanvasStore.getState().edges.some((edge) => edge.source === sourceId && edge.target === targetId)).toBe(true)
  })

  it('does not add an edge from an empty node, self, a video, or a model that rejects refs', () => {
    const emptyId = useCanvasStore.getState().addNode('image', { x: 0, y: 0 })
    const videoId = useCanvasStore.getState().addNode('video', { x: 0, y: 80 }, { url: 'https://vid' })
    const targetId = useCanvasStore.getState().addNode('imageConfig', { x: 320, y: 0 }, { model: 'qwen-image-2.0' })
    useCanvasStore.getState().setReferencePickTarget(targetId)

    expect(applyReferencePickClick(emptyId).action).toBe('blocked')
    expect(applyReferencePickClick(videoId)).toMatchObject({ action: 'blocked', message: REFERENCE_PICK_VIDEO_MESSAGE })
    expect(applyReferencePickClick(targetId)).toMatchObject({ action: 'blocked', message: REFERENCE_PICK_SELF_MESSAGE })
    const filledId = useCanvasStore.getState().addNode('image', { x: 0, y: 160 }, { url: 'https://img/a.png' })
    expect(applyReferencePickClick(filledId)).toMatchObject({
      action: 'blocked',
      message: UNSUPPORTED_REFERENCE_IMAGE_MESSAGE,
    })
    expect(useCanvasStore.getState().edges).toHaveLength(0)
    expect(useCanvasStore.getState().referencePickTargetId).toBe(targetId)
  })

  it('ignores the second click of a double-click and exits with the store flag', () => {
    const sourceId = useCanvasStore.getState().addNode('image', { x: 0, y: 0 }, { url: 'https://img/a.png' })
    const targetId = useCanvasStore.getState().addNode('imageConfig', { x: 320, y: 0 })
    useCanvasStore.getState().setReferencePickTarget(targetId)
    expect(noteReferencePickClick(sourceId, 1_000)).toBe(false)
    expect(noteReferencePickClick(sourceId, 1_200)).toBe(true)
    expect(noteReferencePickClick(sourceId, 1_000 + 500)).toBe(false)

    useCanvasStore.getState().setReferencePickTarget(null)
    expect(applyReferencePickClick(sourceId)).toEqual({ action: 'ignored' })
    useCanvasStore.getState().setReferencePickTarget(targetId)
    useCanvasStore.getState().setReferencePickTarget('missing')
    expect(useCanvasStore.getState().referencePickTargetId).toBeNull()
  })

  it('clears pick mode when the target node is removed or the canvas resets', () => {
    const targetId = useCanvasStore.getState().addNode('imageConfig', { x: 0, y: 0 })
    useCanvasStore.getState().setReferencePickTarget(targetId)
    useCanvasStore.getState().removeNode(targetId)
    expect(useCanvasStore.getState().referencePickTargetId).toBeNull()

    const nextId = useCanvasStore.getState().addNode('videoConfig', { x: 0, y: 0 })
    useCanvasStore.getState().setReferencePickTarget(nextId)
    useCanvasStore.getState().clearCanvas()
    expect(useCanvasStore.getState().referencePickTargetId).toBeNull()
  })
})

describe('audio reference pick', () => {
  it('lets an audio node take text and audio, and refuses pictures', () => {
    const target = node({ id: 'voice', type: 'audio', data: { label: '音频', audioMode: 'tts' } })
    const text = node({ id: 'line', type: 'text', data: { label: '台词', content: '你好' } })
    const emptyText = node({ id: 'blank', type: 'text', data: { label: '空', content: '  ' } })
    const clip = node({ id: 'clip', type: 'audio', data: { label: '参考', url: 'https://cdn/a.mp3' } })
    const emptyClip = node({ id: 'silent', type: 'audio', data: { label: '空音频', url: '' } })
    const picture = node({ id: 'shot', type: 'image', data: { label: '图', url: 'https://img/a.png' } })
    const nodes = [target, text, emptyText, clip, emptyClip, picture]

    expect(assessReferencePick({ source: text, target, nodes, edges: [] }).visual).toBe('pickable')
    expect(assessReferencePick({ source: clip, target, nodes, edges: [] }).visual).toBe('pickable')
    expect(assessReferencePick({ source: emptyText, target, nodes, edges: [] })).toMatchObject({
      visual: 'blocked',
      message: REFERENCE_PICK_TEXT_EMPTY_MESSAGE,
    })
    expect(assessReferencePick({ source: emptyClip, target, nodes, edges: [] })).toMatchObject({
      visual: 'blocked',
      message: REFERENCE_PICK_AUDIO_EMPTY_MESSAGE,
    })
    expect(assessReferencePick({ source: picture, target, nodes, edges: [] })).toMatchObject({
      visual: 'blocked',
      message: REFERENCE_PICK_AUDIO_TYPE_MESSAGE,
    })
  })

  it('still blocks an audio source on a 画面 node', () => {
    const target = node({ id: 'gen', type: 'imageConfig', data: { label: '画面', model: 'gpt-image-2' } })
    const clip = node({ id: 'clip', type: 'audio', data: { label: '音频', url: 'https://cdn/a.mp3' } })
    expect(assessReferencePick({ source: clip, target, nodes: [target, clip], edges: [] })).toMatchObject({
      visual: 'blocked',
      block: 'type',
      message: REFERENCE_PICK_TYPE_MESSAGE,
    })
  })
})

describe('withReferencePickClasses', () => {
  it('leaves the node list untouched outside pick mode and tags visuals while picking', () => {
    const target = node({ id: 'gen', type: 'imageConfig', data: { label: 'gen', model: 'gpt-image-2' } })
    const source = node({ id: 'shot', type: 'image', data: { label: 'shot', url: 'https://img/a.png' } })
    const nodes = [target, source]
    expect(withReferencePickClasses(nodes, [], null)).toBe(nodes)
    const decorated = withReferencePickClasses(nodes, [], 'gen')
    expect(decorated[0]).toMatchObject({ className: 'reference-pick-blocked' })
    expect(decorated[1]).toMatchObject({ className: 'reference-pick-pickable' })
    expect(nodes[1]).not.toHaveProperty('className')
  })
})
