import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useCallback: <T,>(fn: T) => fn,
    useSyncExternalStore: (_subscribe: () => void, getSnapshot: () => boolean) => getSnapshot(),
  }
})

vi.mock('antd', () => ({
  message: {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}))

const generateImage = vi.fn()
const generateVideo = vi.fn()

vi.mock('./useImageGeneration', () => ({
  useImageGeneration: () => ({ generate: generateImage }),
}))

vi.mock('./useVideoGeneration', () => ({
  useVideoGeneration: () => ({ generate: generateVideo }),
}))

import { audioService } from '@/api/aigc'
import { useModelsStore } from '@/store/modelsStore'
import { useCanvasStore } from '../stores/canvasStore'
import type { CustomNode } from '../types'
import { cancelGenerationJob, hasGenerationJob } from '../utils/generationJobs'
import { useNodeGenerateAction } from './useNodeGenerateAction'

const nodeIds = ['img', 'vid', 'aud']

function node(partial: Pick<CustomNode, 'id' | 'type'> & { data?: CustomNode['data'] }): CustomNode {
  return {
    id: partial.id,
    type: partial.type,
    position: { x: 0, y: 0 },
    data: partial.data ?? {},
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.spyOn(audioService, 'generate').mockResolvedValue('https://cdn.example/line.mp3')
})

afterEach(() => {
  for (const id of nodeIds) cancelGenerationJob(id)
  generateImage.mockReset()
  generateVideo.mockReset()
  vi.restoreAllMocks()
  useCanvasStore.setState({ nodes: [], edges: [], currentProjectId: null })
  useModelsStore.getState().clearCache()
})

describe('useNodeGenerateAction double submit', () => {
  it('submits an image once when Generate is invoked again before the job settles', async () => {
    useCanvasStore.setState({
      nodes: [node({
        id: 'img',
        type: 'imageConfig',
        data: { prompt: 'a cat', model: 'gpt-image-2', n: 4, size: '1024x1024' },
      })],
      edges: [],
      currentProjectId: 'proj',
    })
    const gate = deferred<string[]>()
    generateImage.mockImplementation(() => gate.promise)

    const { send, sending } = useNodeGenerateAction('img')
    expect(sending).toBe(false)

    const first = send('a cat')
    const second = send('a cat')
    const third = send('a cat')

    expect(generateImage).toHaveBeenCalledTimes(1)
    expect(generateImage.mock.calls[0][0].n).toBe(4)
    expect(generateImage.mock.calls[0][0].signal.aborted).toBe(false)
    expect(hasGenerationJob('img')).toBe(true)
    expect(useNodeGenerateAction('img').sending).toBe(true)

    gate.resolve(['https://cdn.example/cat.png'])
    await first
    await second
    await third

    expect(generateImage).toHaveBeenCalledTimes(1)
    expect(hasGenerationJob('img')).toBe(false)
    expect(useNodeGenerateAction('img').sending).toBe(false)
  })

  it('keeps a video quantity batch inside one click and blocks a second click', async () => {
    useCanvasStore.setState({
      nodes: [node({
        id: 'vid',
        type: 'videoConfig',
        data: {
          prompt: 'a wave',
          model: 'happyhorse-1.1-t2v',
          n: 4,
          duration: 5,
          ratio: '16:9',
          resolution: '720P',
          size: '1280*720',
        },
      })],
      edges: [],
      currentProjectId: 'proj',
    })
    const gates = Array.from({ length: 4 }, () => deferred<string>())
    generateVideo.mockImplementation(() => {
      const gate = gates[generateVideo.mock.calls.length - 1]
      return gate.promise
    })

    const { send } = useNodeGenerateAction('vid')
    const first = send('a wave')
    await Promise.resolve()
    const second = send('a wave')

    expect(generateVideo).toHaveBeenCalledTimes(4)
    const signals = generateVideo.mock.calls.map((call) => call[0].signal as AbortSignal)
    expect(new Set(signals).size).toBe(1)
    expect(signals[0].aborted).toBe(false)
    expect(hasGenerationJob('vid')).toBe(true)

    gates.forEach((gate, index) => gate.resolve(`https://cdn.example/clip-${index}.mp4`))
    await first
    await second
    expect(generateVideo).toHaveBeenCalledTimes(4)
    expect(hasGenerationJob('vid')).toBe(false)
  })

  it('submits audio once and releases the lock when the model catalog is not ready', async () => {
    useCanvasStore.setState({
      nodes: [node({
        id: 'aud',
        type: 'audio',
        data: { prompt: 'hello', model: 'speech-2.8-hd', audioMode: 'tts' },
      })],
      edges: [],
    })

    const { send } = useNodeGenerateAction('aud')
    await send('hello')
    expect(audioService.generate).not.toHaveBeenCalled()
    expect(hasGenerationJob('aud')).toBe(false)

    useModelsStore.setState({
      audio: {
        models: [{ id: 'speech-2.8-hd', name: 'Speech', isEnabled: true } as never],
        status: 'success',
        error: null,
        lastFetchedAt: Date.now(),
      },
    })
    const gate = deferred<string>()
    vi.mocked(audioService.generate).mockImplementation(() => gate.promise as Promise<never>)

    const first = send('hello')
    const second = send('hello')
    expect(audioService.generate).toHaveBeenCalledTimes(1)
    expect(hasGenerationJob('aud')).toBe(true)

    gate.resolve('https://cdn.example/line.mp3')
    await first
    await second
    expect(audioService.generate).toHaveBeenCalledTimes(1)
    expect(hasGenerationJob('aud')).toBe(false)
  })
})
