import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../utils/indexedDB', () => ({
  migrateFromLocalStorage: vi.fn(),
  getAllProjects: vi.fn().mockResolvedValue([]),
  saveAllProjects: vi.fn().mockResolvedValue(undefined),
  deleteProject: vi.fn(),
}))

vi.mock('@/features/project/api/workflows', () => ({
  workflowsApi: {
    getAll: vi.fn(),
  },
}))

import { workflowsApi } from '@/features/project/api/workflows'
import { useCanvasDocumentsStore } from './projectsStore'

const storedCanvas = {
  nodes: [{ id: 'n1', type: 'text', position: { x: 0, y: 0 }, data: { content: 'kept' } }],
  edges: [{ id: 'e1', source: 'n1', target: 'n1' }],
  viewport: { x: 1, y: 2, zoom: 1 },
}

describe('syncProjectWorkflows', () => {
  beforeEach(() => {
    useCanvasDocumentsStore.setState({ projects: [], currentProjectId: null })
    vi.mocked(workflowsApi.getAll).mockReset()
  })

  it('keeps a previously loaded canvas when the list omits canvasData', async () => {
    useCanvasDocumentsStore.setState({
      projects: [
        {
          id: 'workflow_a',
          name: '旧名',
          thumbnail: '',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          projectId: '4',
          sourceType: 'blank',
          canvasData: storedCanvas,
        },
      ],
    })
    vi.mocked(workflowsApi.getAll).mockResolvedValue({
      success: true,
      data: {
        list: [
          {
            id: 'workflow_a',
            projectId: '4',
            name: '新名',
            sourceType: 'blank',
            status: 'draft',
            modified: '2026-09-01T00:00:00.000Z',
          },
        ],
        pagination: { page: 1, size: 100, total: 1 },
      },
    })

    await useCanvasDocumentsStore.getState().syncProjectWorkflows('4')

    const saved = useCanvasDocumentsStore.getState().projects[0]
    expect(saved.name).toBe('新名')
    expect(saved.canvasData.nodes).toHaveLength(1)
    expect(saved.canvasData.nodes[0].id).toBe('n1')
    expect(saved.canvasData.edges).toHaveLength(1)
    expect(saved.nodeCount).toBeUndefined()
  })

  it('stores the server nodeCount instead of the empty placeholder canvas', async () => {
    useCanvasDocumentsStore.setState({
      projects: [
        {
          id: 'workflow_a',
          name: '旧名',
          thumbnail: '',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          projectId: '4',
          sourceType: 'scene',
          nodeCount: 1,
          canvasData: storedCanvas,
        },
      ],
    })
    vi.mocked(workflowsApi.getAll).mockResolvedValue({
      success: true,
      data: {
        list: [
          {
            id: 'workflow_a',
            projectId: '4',
            name: '场景工作流',
            sourceType: 'scene',
            status: 'draft',
            modified: '2026-09-01T00:00:00.000Z',
            nodeCount: 3,
            edgeCount: 2,
          },
          {
            id: 'workflow_empty',
            projectId: '4',
            name: '空白工作流',
            sourceType: 'blank',
            status: 'draft',
            modified: '2026-08-01T00:00:00.000Z',
            nodeCount: 0,
            edgeCount: 0,
          },
        ],
        pagination: { page: 1, size: 100, total: 2 },
      },
    })

    await useCanvasDocumentsStore.getState().syncProjectWorkflows('4')

    const saved = useCanvasDocumentsStore.getState().projects.find((item) => item.id === 'workflow_a')
    const empty = useCanvasDocumentsStore.getState().projects.find((item) => item.id === 'workflow_empty')
    expect(saved?.nodeCount).toBe(3)
    expect(saved?.edgeCount).toBe(2)
    expect(saved?.canvasData.nodes).toHaveLength(1)
    expect(empty).toBeUndefined()
  })

  it('keeps the open empty canvas while editing and drops it from the workflow list', async () => {
    useCanvasDocumentsStore.setState({
      projects: [
        {
          id: 'draft_open',
          name: '空白工作流',
          thumbnail: '',
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
          updatedAt: new Date('2026-08-01T00:00:00.000Z'),
          projectId: '4',
          sourceType: 'blank',
          nodeCount: 0,
          edgeCount: 0,
          canvasData: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
        },
      ],
    })
    vi.mocked(workflowsApi.getAll).mockResolvedValue({
      success: true,
      data: {
        list: [
          {
            id: 'workflow_scene',
            projectId: '4',
            name: '场景工作流',
            sourceType: 'scene',
            status: 'draft',
            modified: '2026-09-01T00:00:00.000Z',
            nodeCount: 2,
            edgeCount: 0,
          },
        ],
        pagination: { page: 1, size: 100, total: 1 },
      },
    })

    await useCanvasDocumentsStore.getState().syncProjectWorkflows('4', 'draft_open')
    expect(useCanvasDocumentsStore.getState().projects.map((item) => item.id).sort()).toEqual([
      'draft_open',
      'workflow_scene',
    ])

    await useCanvasDocumentsStore.getState().syncProjectWorkflows('4')
    expect(useCanvasDocumentsStore.getState().projects.map((item) => item.id)).toEqual(['workflow_scene'])
  })

  it('clears a stale loading flag kept from a previous canvas', async () => {
    useCanvasDocumentsStore.setState({
      projects: [
        {
          id: 'workflow_a',
          name: '旧名',
          thumbnail: '',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          projectId: '4',
          sourceType: 'blank',
          canvasData: {
            nodes: [{
              id: 'gen',
              type: 'imageConfig',
              position: { x: 0, y: 0 },
              data: { label: '画面节点', loading: true },
            }],
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 },
          },
        },
      ],
    })
    vi.mocked(workflowsApi.getAll).mockResolvedValue({
      success: true,
      data: {
        list: [
          {
            id: 'workflow_a',
            projectId: '4',
            name: '新名',
            sourceType: 'blank',
            status: 'draft',
            modified: '2026-09-01T00:00:00.000Z',
          },
        ],
        pagination: { page: 1, size: 100, total: 1 },
      },
    })

    await useCanvasDocumentsStore.getState().syncProjectWorkflows('4')

    const node = useCanvasDocumentsStore.getState().projects[0].canvasData.nodes[0]
    expect(node.data.loading).toBe(false)
    expect(node.data.error).toBe('生成中断，请重新生成')
  })

  it('uses an empty canvas for a workflow the client has never loaded', async () => {
    vi.mocked(workflowsApi.getAll).mockResolvedValue({
      success: true,
      data: {
        list: [
          {
            id: 'workflow_new',
            projectId: '4',
            name: '未打开',
            sourceType: 'blank',
            status: 'draft',
            modified: '2026-09-01T00:00:00.000Z',
          },
        ],
        pagination: { page: 1, size: 100, total: 1 },
      },
    })

    await useCanvasDocumentsStore.getState().syncProjectWorkflows('4')

    const saved = useCanvasDocumentsStore.getState().projects[0]
    expect(saved.canvasData.nodes).toEqual([])
    expect(saved.canvasData.edges).toEqual([])
    expect(saved.nodeCount).toBeUndefined()
  })

  it('tracks nodeCount from the canvas once it is actually loaded or edited', () => {
    useCanvasDocumentsStore.getState().createWorkflowDocument({
      id: 'workflow_blank',
      name: '空白工作流',
      projectId: '4',
      sourceType: 'blank',
    })
    expect(useCanvasDocumentsStore.getState().projects[0].nodeCount).toBe(0)

    useCanvasDocumentsStore.getState().updateProjectCanvas('workflow_blank', {
      nodes: [{ id: 'n1', type: 'text', position: { x: 0, y: 0 }, data: { content: '草稿' } }],
    })
    expect(useCanvasDocumentsStore.getState().projects[0].nodeCount).toBe(1)

    useCanvasDocumentsStore.getState().createWorkflowDocument({
      id: 'workflow_blank',
      name: '空白工作流',
      projectId: '4',
      sourceType: 'blank',
      canvasData: {
        nodes: [
          { id: 'n1', type: 'text', position: { x: 0, y: 0 }, data: {} },
          { id: 'n2', type: 'text', position: { x: 10, y: 10 }, data: {} },
        ],
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    })
    const saved = useCanvasDocumentsStore.getState().projects[0]
    expect(saved.nodeCount).toBe(2)
    expect(saved.edgeCount).toBe(1)
  })
})
