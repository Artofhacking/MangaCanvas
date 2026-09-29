import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/features/infinite-canvas/utils/indexedDB', () => ({
  migrateFromLocalStorage: vi.fn(),
  getAllProjects: vi.fn().mockResolvedValue([]),
  saveAllProjects: vi.fn().mockResolvedValue(undefined),
  deleteProject: vi.fn(),
}))

vi.mock('@/features/project/api/workflows', () => ({
  workflowsApi: {
    getAll: vi.fn(),
    update: vi.fn(),
  },
}))

import { uploadApi } from '@/api/uploadApi'
import { workflowsApi } from '@/features/project/api/workflows'
import { useCanvasStore } from '@/features/infinite-canvas/stores/canvasStore'
import {
  CANVAS_AUTOSAVE_DEBOUNCE_MS,
  persistOpenCanvas,
  resetCanvasAutosaveForTests,
} from './persistCanvas'

const PNG = 'data:image/png;base64,iVBORw0KGgo='
const STORED = '/static/uploads/generated/shot.png'

function textNode(content: string) {
  return {
    id: 'n1',
    type: 'text',
    position: { x: 0, y: 0 },
    data: { label: '文本', content },
  }
}

describe('persistOpenCanvas', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    resetCanvasAutosaveForTests()
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      currentProjectId: 'workflow_1',
      history: [],
      historyIndex: -1,
    })
    vi.mocked(workflowsApi.update).mockReset()
    vi.mocked(workflowsApi.update).mockResolvedValue({ success: true, data: {} as never })
    vi.spyOn(uploadApi, 'uploadSingleFile').mockResolvedValue(STORED)
  })

  it('stores pasted bitmaps as file URLs and does not PUT the data URL', async () => {
    useCanvasStore.setState({
      nodes: [
        {
          id: 'img',
          type: 'image',
          position: { x: 0, y: 0 },
          data: { label: '上传图片', url: PNG, base64: PNG },
        },
      ],
    })

    await persistOpenCanvas({ projectId: 8, workflowId: 'workflow_1', immediate: true })

    expect(uploadApi.uploadSingleFile).toHaveBeenCalledTimes(1)
    expect(vi.mocked(uploadApi.uploadSingleFile).mock.calls[0][1]).toBe('generated')
    const uploaded = vi.mocked(uploadApi.uploadSingleFile).mock.calls[0][0]
    expect(new TextDecoder().decode(await uploaded.arrayBuffer())).not.toContain('data:image')
    const payload = vi.mocked(workflowsApi.update).mock.calls[0][2]
    expect(JSON.stringify(payload)).not.toContain('data:image')
    expect(payload?.canvasData?.nodes?.[0]).toMatchObject({
      data: { url: STORED, label: '上传图片' },
    })
    expect(useCanvasStore.getState().nodes[0].data.base64).toBeUndefined()
    expect(useCanvasStore.getState().nodes[0].data.url).toBe(STORED)
  })

  it('coalesces an unchanged autosave and overlapping edits into one in-flight PUT', async () => {
    const releases: Array<() => void> = []
    vi.mocked(workflowsApi.update).mockImplementation(
      () =>
        new Promise((resolve) => {
          releases.push(() => resolve({ success: true, data: {} as never }))
        }),
    )
    useCanvasStore.setState({ nodes: [textNode('第一稿')] })

    const first = persistOpenCanvas({ projectId: 8, workflowId: 'workflow_1', immediate: true })
    await vi.waitFor(() => expect(workflowsApi.update).toHaveBeenCalledTimes(1))

    useCanvasStore.setState({ nodes: [textNode('第二稿')] })
    const second = persistOpenCanvas({ projectId: 8, workflowId: 'workflow_1', immediate: true })
    expect(workflowsApi.update).toHaveBeenCalledTimes(1)

    releases[0]()
    await vi.waitFor(() => expect(workflowsApi.update).toHaveBeenCalledTimes(2))
    releases[1]()
    await first
    await second

    expect(vi.mocked(workflowsApi.update).mock.calls[1][2]).toMatchObject({
      canvasData: { nodes: [expect.objectContaining({ data: expect.objectContaining({ content: '第二稿' }) })] },
    })

    await persistOpenCanvas({ projectId: 8, workflowId: 'workflow_1', immediate: true })
    expect(workflowsApi.update).toHaveBeenCalledTimes(2)
  })

  it('debounces a burst of saves into a single PUT', async () => {
    vi.useFakeTimers()
    try {
      useCanvasStore.setState({ nodes: [textNode('甲')] })
      const first = persistOpenCanvas({ projectId: 8, workflowId: 'workflow_1' })
      useCanvasStore.setState({ nodes: [textNode('乙')] })
      const second = persistOpenCanvas({ projectId: 8, workflowId: 'workflow_1' })
      await vi.advanceTimersByTimeAsync(CANVAS_AUTOSAVE_DEBOUNCE_MS)
      await first
      await second
      expect(workflowsApi.update).toHaveBeenCalledTimes(1)
      expect(vi.mocked(workflowsApi.update).mock.calls[0][2]).toMatchObject({
        canvasData: { nodes: [expect.objectContaining({ data: expect.objectContaining({ content: '乙' }) })] },
      })
    } finally {
      vi.useRealTimers()
    }
  })
})
