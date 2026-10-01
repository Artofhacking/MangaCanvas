import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api', () => ({
  appClient: {},
  requestData: vi.fn(),
}))

import { requestData } from '@/api'
import { workflowsApi } from './workflows'

const mockedRequest = vi.mocked(requestData)

describe('workflowsApi canvas payload', () => {
  beforeEach(() => {
    mockedRequest.mockReset()
  })

  it('leaves canvasData unset when the list payload omits it', async () => {
    mockedRequest.mockResolvedValue({
      list: [
        {
          id: 'workflow_a',
          projectId: 4,
          name: '大画布',
          sourceType: 'blank',
          status: 'draft',
          updatedAt: '2026-09-01T00:00:00.000Z',
        },
      ],
      pagination: { page: 1, size: 20, total: 1 },
    })

    const response = await workflowsApi.getAll(4, { page: 1, size: 20 })

    expect(response.success).toBe(true)
    if (!response.success) return
    expect(response.data.list[0].canvasData).toBeUndefined()
    expect(response.data.list[0].nodeCount).toBeUndefined()
    expect(response.data.list[0].edgeCount).toBeUndefined()
    expect(response.data.list[0].name).toBe('大画布')
    expect(response.data.pagination).toEqual({ page: 1, size: 20, total: 1 })
  })

  it('keeps the server nodeCount when the list omits canvasData', async () => {
    mockedRequest.mockResolvedValue({
      list: [
        {
          id: 'workflow_a',
          projectId: 4,
          name: '场景工作流',
          sourceType: 'scene',
          status: 'draft',
          updatedAt: '2026-09-01T00:00:00.000Z',
          nodeCount: 2,
          edgeCount: 1,
        },
      ],
      pagination: { page: 1, size: 20, total: 1 },
    })

    const response = await workflowsApi.getAll(4)
    expect(response.success).toBe(true)
    if (!response.success) return
    expect(response.data.list[0].canvasData).toBeUndefined()
    expect(response.data.list[0].nodeCount).toBe(2)
    expect(response.data.list[0].edgeCount).toBe(1)
  })

  it('keeps the full canvas on detail', async () => {
    mockedRequest.mockResolvedValue({
      id: 'workflow_a',
      projectId: 4,
      name: '大画布',
      sourceType: 'blank',
      status: 'draft',
      updatedAt: '2026-09-01T00:00:00.000Z',
      canvasData: {
        nodes: [{ id: 'n1', type: 'text', data: {} }],
        edges: [{ id: 'e1', source: 'n1', target: 'n1' }],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    })

    const response = await workflowsApi.getById(4, 'workflow_a')

    expect(response.success).toBe(true)
    if (!response.success) return
    expect(response.data?.canvasData?.nodes).toHaveLength(1)
    expect(response.data?.canvasData?.edges).toHaveLength(1)
  })
})
