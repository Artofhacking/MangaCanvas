import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/features/project/api/workflows', () => ({
  workflowsApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}))

import { workflowsApi } from '@/features/project/api/workflows'
import { openOrCreateWorkflow } from './workflows'

const listHit = {
  id: 'workflow_ep',
  projectId: '1',
  name: '第01集 工作流',
  sourceType: 'episode' as const,
  sourceAssetId: 9,
  status: 'draft' as const,
  modified: '2026-01-01T00:00:00.000Z',
}

describe('openOrCreateWorkflow without list canvas', () => {
  beforeEach(() => {
    vi.mocked(workflowsApi.getAll).mockReset()
    vi.mocked(workflowsApi.getById).mockReset()
    vi.mocked(workflowsApi.update).mockReset()
    vi.mocked(workflowsApi.create).mockReset()
    vi.mocked(workflowsApi.getAll).mockResolvedValue({
      success: true,
      data: { list: [listHit], pagination: { page: 1, size: 100, total: 1 } },
    })
  })

  it('reads the detail canvas before deciding whether to rebuild', async () => {
    vi.mocked(workflowsApi.getById).mockResolvedValue({
      success: true,
      data: {
        ...listHit,
        canvasData: {
          nodes: [
            { id: 'act_1', type: 'text', data: { content: '短句', label: '第一幕' } },
            {
              id: 'seed_character_1',
              type: 'image',
              data: { url: 'https://cdn.example/lin.png', label: '林深', sourceType: 'character', sourceAssetId: '1' },
            },
          ],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        },
      },
    })

    const result = await openOrCreateWorkflow({
      projectId: '1',
      sourceType: 'episode',
      sourceName: '第01集',
      sourceAssetId: 9,
    })

    expect(workflowsApi.getById).toHaveBeenCalledWith(1, 'workflow_ep')
    expect(workflowsApi.update).not.toHaveBeenCalled()
    expect(result?.created).toBe(false)
    expect(result?.canvasData.nodes.map((node) => node.id)).toEqual(['act_1', 'seed_character_1'])
  })

  it('does not overwrite the workflow when detail canvas is unavailable', async () => {
    vi.mocked(workflowsApi.getById).mockResolvedValue({
      success: false,
      data: null,
      message: '获取工作流详情失败',
    })

    const result = await openOrCreateWorkflow({
      projectId: '1',
      sourceType: 'episode',
      sourceName: '第01集',
      sourceAssetId: 9,
    })

    expect(workflowsApi.update).not.toHaveBeenCalled()
    expect(workflowsApi.create).not.toHaveBeenCalled()
    expect(result).toMatchObject({ id: 'workflow_ep', created: false, canvasData: { nodes: [], edges: [] } })
  })
})
