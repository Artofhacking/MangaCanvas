import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/aigc/videoService', () => ({
  videoService: {
    cancel: vi.fn(),
    watch: vi.fn(),
  },
}))

import { videoService } from '@/api/aigc/videoService'
import { useCanvasStore } from '../stores/canvasStore'
import { resetCanvasAutosaveForTests } from '@/lib/persistCanvas'
import { hasGenerationJob, stopLocalGenerationJobs } from './generationJobs'
import { beginCanvasVideoJobResume, bindNodeVideoResumeCancel } from './resumeVideoJobs'
import { readVideoJobIds } from './videoJobBinding'

const watch = vi.mocked(videoService.watch)
const cancel = vi.mocked(videoService.cancel)

function clipNode(jobIds: string[]) {
  return {
    id: 'clip',
    type: 'video',
    position: { x: 0, y: 0 },
    data: {
      label: '视频节点',
      videoJobIds: jobIds,
      n: 1,
    },
  }
}

describe('resume persisted video jobs', () => {
  afterEach(() => {
    stopLocalGenerationJobs()
    resetCanvasAutosaveForTests()
    watch.mockReset()
    cancel.mockReset()
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      currentProjectId: null,
      history: [],
      historyIndex: -1,
    })
  })

  it('shows generating, then writes the url when the saved job finishes', async () => {
    let release: (job: { job_id: string; status: 'succeeded'; url: string }) => void = () => {}
    watch.mockImplementation((_jobId, options) => {
      options?.onProgress?.({ status: 'RUNNING', taskId: 'job_1', percent: 40 })
      return new Promise((resolve) => {
        release = resolve
      })
    })
    useCanvasStore.setState({
      currentProjectId: 'workflow_1',
      nodes: [clipNode(['job_1'])],
    })

    beginCanvasVideoJobResume()

    const generating = useCanvasStore.getState().nodes[0].data
    expect(generating.loading).toBe(true)
    expect(generating.statusLabel).toBe('生成中')
    expect(generating.progress).toBe(40)
    expect(hasGenerationJob('clip')).toBe(true)
    expect(bindNodeVideoResumeCancel('clip', useCanvasStore.getState().updateNode)).toEqual(expect.any(Function))

    release({ job_id: 'job_1', status: 'succeeded', url: 'https://cdn.example/a.mp4' })
    await vi.waitFor(() => {
      expect(useCanvasStore.getState().nodes[0].data.url).toBe('https://cdn.example/a.mp4')
    })
    const done = useCanvasStore.getState().nodes[0].data
    expect(done.loading).toBe(false)
    expect(done.error).toBe('')
    expect(readVideoJobIds(done)).toEqual([])
    expect(hasGenerationJob('clip')).toBe(false)
  })

  it('cancels from the persisted job id when this tab has no poller', () => {
    useCanvasStore.setState({
      currentProjectId: 'workflow_1',
      nodes: [clipNode(['job_9'])],
    })
    const updateNode = useCanvasStore.getState().updateNode
    const onCancel = bindNodeVideoResumeCancel('clip', updateNode)
    expect(hasGenerationJob('clip')).toBe(false)
    expect(onCancel).toEqual(expect.any(Function))

    onCancel?.()

    expect(cancel).toHaveBeenCalledWith('job_9')
    const data = useCanvasStore.getState().nodes[0].data
    expect(data.loading).toBe(false)
    expect(data.error).toBe('')
    expect(readVideoJobIds(data)).toEqual([])
  })
})
