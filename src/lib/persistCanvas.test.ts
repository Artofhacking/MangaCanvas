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
    create: vi.fn(),
    delete: vi.fn(),
  },
}))

import { uploadApi } from '@/api/uploadApi'
import { workflowsApi } from '@/features/project/api/workflows'
import { useCanvasStore } from '@/features/infinite-canvas/stores/canvasStore'
import { useCanvasDocumentsStore } from '@/features/infinite-canvas/stores/projectsStore'
import {
  CANVAS_AUTOSAVE_DEBOUNCE_MS,
  noteWorkflowLoaded,
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
    useCanvasDocumentsStore.setState({ projects: [], currentProjectId: null })
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      currentProjectId: 'workflow_1',
      history: [],
      historyIndex: -1,
    })
    vi.mocked(workflowsApi.update).mockReset()
    vi.mocked(workflowsApi.update).mockResolvedValue({ success: true, data: { id: 'workflow_1', name: '工作流', projectId: '8', sourceType: 'blank', status: 'draft', modified: '2026-01-01T00:00:00.000Z' } })
    vi.mocked(workflowsApi.create).mockReset()
    vi.mocked(workflowsApi.delete).mockReset()
    vi.mocked(workflowsApi.delete).mockResolvedValue({ success: true, data: true })
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

  it('persists video job ids and drops in-flight generating fields', async () => {
    useCanvasStore.setState({
      nodes: [
        {
          id: 'clip',
          type: 'video',
          position: { x: 0, y: 0 },
          data: {
            label: '视频节点',
            loading: true,
            progress: 35,
            statusLabel: '生成中',
            videoJobIds: ['job_1', 'job_2'],
            prompt: '雨夜',
          },
        },
      ],
    })

    await persistOpenCanvas({ projectId: 8, workflowId: 'workflow_1', immediate: true })

    const saved = vi.mocked(workflowsApi.update).mock.calls[0][2]?.canvasData?.nodes?.[0] as {
      data?: Record<string, unknown>
    }
    expect(saved?.data).toMatchObject({
      label: '视频节点',
      prompt: '雨夜',
      videoJobIds: ['job_1', 'job_2'],
    })
    expect(saved?.data).not.toHaveProperty('loading')
    expect(saved?.data).not.toHaveProperty('progress')
    expect(saved?.data).not.toHaveProperty('statusLabel')
    expect(useCanvasStore.getState().nodes[0].data.loading).toBe(true)
    expect(useCanvasStore.getState().nodes[0].data.statusLabel).toBe('生成中')

    useCanvasStore.setState({
      nodes: [
        {
          id: 'clip',
          type: 'video',
          position: { x: 0, y: 0 },
          data: {
            label: '视频节点',
            loading: true,
            progress: 80,
            statusLabel: '生成中',
            videoJobIds: ['job_1', 'job_2'],
            prompt: '雨夜',
          },
        },
      ],
    })
    await persistOpenCanvas({ projectId: 8, workflowId: 'workflow_1', immediate: true })
    expect(workflowsApi.update).toHaveBeenCalledTimes(1)
  })

  it('does not create or update a blank draft, and deletes a loaded workflow once it has no nodes', async () => {
    useCanvasStore.setState({ currentProjectId: 'draft_1', nodes: [] })
    await persistOpenCanvas({ projectId: 8, workflowId: 'draft_1', immediate: true })
    expect(workflowsApi.create).not.toHaveBeenCalled()
    expect(workflowsApi.update).not.toHaveBeenCalled()
    expect(workflowsApi.delete).not.toHaveBeenCalled()

    useCanvasStore.setState({ currentProjectId: 'workflow_1', nodes: [] })
    await persistOpenCanvas({ projectId: 8, workflowId: 'workflow_1', immediate: true })
    expect(workflowsApi.delete).not.toHaveBeenCalled()

    noteWorkflowLoaded('workflow_1')
    await persistOpenCanvas({ projectId: 8, workflowId: 'workflow_1', immediate: true })
    expect(workflowsApi.delete).toHaveBeenCalledWith(8, 'workflow_1')
    expect(workflowsApi.update).not.toHaveBeenCalled()
    expect(workflowsApi.create).not.toHaveBeenCalled()
  })

  it('creates the server row on the first non-empty save of a draft and keeps later edits on that id', async () => {
    vi.mocked(workflowsApi.create).mockResolvedValue({
      success: true,
      data: {
        id: 'workflow_server',
        projectId: '8',
        name: '空白工作流',
        sourceType: 'blank',
        status: 'draft',
        modified: '2026-09-01T00:00:00.000Z',
        canvasData: {
          nodes: [textNode('第一笔')],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        },
      },
    })
    useCanvasDocumentsStore.setState({
      projects: [
        {
          id: 'draft_1',
          name: '空白工作流',
          thumbnail: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          projectId: '8',
          sourceType: 'blank',
          nodeCount: 0,
          edgeCount: 0,
          canvasData: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
        },
      ],
      currentProjectId: null,
    })
    useCanvasStore.setState({ currentProjectId: 'draft_1', nodes: [textNode('第一笔')] })

    await persistOpenCanvas({ projectId: 8, workflowId: 'draft_1', immediate: true })

    expect(workflowsApi.create).toHaveBeenCalledTimes(1)
    expect(workflowsApi.update).not.toHaveBeenCalled()
    expect(vi.mocked(workflowsApi.create).mock.calls[0][1]).toMatchObject({
      name: '空白工作流',
      sourceType: 'blank',
    })
    expect(useCanvasStore.getState().currentProjectId).toBe('workflow_server')

    useCanvasStore.setState({ nodes: [textNode('第二笔')] })
    await persistOpenCanvas({ projectId: 8, workflowId: 'draft_1', immediate: true })
    expect(workflowsApi.create).toHaveBeenCalledTimes(1)
    expect(workflowsApi.update).toHaveBeenCalledTimes(1)
    expect(vi.mocked(workflowsApi.update).mock.calls[0][1]).toBe('workflow_server')
  })
})
