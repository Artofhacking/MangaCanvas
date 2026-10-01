import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from '../stores/canvasStore'
import { collectGenerateInputs, getIncomingReferenceSlots, isGenerateNodeType } from './generateSlots'

describe('audio generate node', () => {
  beforeEach(() => {
    useCanvasStore.getState().clearCanvas()
  })

  it('registers a single audio node as a generate target with 配音 defaults', () => {
    expect(isGenerateNodeType('audio')).toBe(true)
    expect(isGenerateNodeType('sound')).toBe(false)
    const id = useCanvasStore.getState().addNode('audio', { x: 0, y: 0 })
    const node = useCanvasStore.getState().nodes.find((item) => item.id === id)
    expect(node?.type).toBe('audio')
    expect(node?.data).toMatchObject({
      label: '音频',
      audioMode: 'tts',
      prompt: '',
      url: '',
    })
  })

  it('exposes an uploaded audio node as an audio reference without mixing it into image urls', () => {
    const audioId = useCanvasStore.getState().addNode('audio', { x: 0, y: 0 }, {
      url: 'https://cdn/voice.mp3',
      label: '旁白',
    })
    const videoId = useCanvasStore.getState().addNode('videoConfig', { x: 320, y: 0 })
    useCanvasStore.getState().addEdgeManually({ source: audioId, target: videoId })

    const { nodes, edges } = useCanvasStore.getState()
    const slots = getIncomingReferenceSlots(videoId, nodes, edges)
    expect(slots[0]).toMatchObject({ kind: 'audio', label: '旁白', sourceId: audioId })
    const inputs = collectGenerateInputs(videoId, nodes, edges)
    expect(inputs.refAudios).toEqual(['https://cdn/voice.mp3'])
    expect(inputs.refImages).toEqual([])
    expect(inputs.firstFrameImage).toBe('')
  })

  it('collects text and audio references on the audio node itself', () => {
    const textId = useCanvasStore.getState().addNode('text', { x: 0, y: 0 }, { content: '你好' })
    const refId = useCanvasStore.getState().addNode('audio', { x: 0, y: 200 }, { url: 'https://cdn/ref.wav' })
    const targetId = useCanvasStore.getState().addNode('audio', { x: 360, y: 80 })
    useCanvasStore.getState().addEdgeManually({ source: textId, target: targetId })
    useCanvasStore.getState().addEdgeManually({ source: refId, target: targetId })

    const { nodes, edges } = useCanvasStore.getState()
    const inputs = collectGenerateInputs(targetId, nodes, edges, {
      localPrompt: '读这段',
      promptSource: 'bar',
    })
    expect(inputs.slots.map((slot) => slot.kind)).toEqual(['text', 'audio'])
    expect(inputs.textSnippets).toEqual(['你好'])
    expect(inputs.refAudios).toEqual(['https://cdn/ref.wav'])
    expect(inputs.prompt).toBe('读这段')
  })
})
