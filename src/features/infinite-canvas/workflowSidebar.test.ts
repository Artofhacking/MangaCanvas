import { describe, expect, it } from 'vitest'

import { canvasSidebarWorkflows, workflowNodeCountLabel } from './workflowSidebar'

describe('canvasSidebarWorkflows', () => {
  const rows = [
    { id: 'empty', name: '空白工作流', nodeCount: 0 },
    { id: 'open-empty', name: '正在编辑', nodeCount: 0 },
    { id: 'scene', name: '场景工作流', nodeCount: 2 },
    { id: 'office', name: '办公室', nodeCount: 3 },
    { id: 'unknown', name: '未计数' },
  ]

  it('hides true empty workflows except the one currently open', () => {
    expect(canvasSidebarWorkflows(rows, 'open-empty').map((item) => item.id)).toEqual([
      'open-empty',
      'scene',
      'office',
      'unknown',
    ])
  })

  it('hides every empty workflow when the open canvas already has nodes', () => {
    expect(canvasSidebarWorkflows(rows, 'scene').map((item) => item.id)).toEqual([
      'scene',
      'office',
      'unknown',
    ])
  })

  it('does not treat a missing nodeCount as zero', () => {
    expect(workflowNodeCountLabel(undefined)).toBeNull()
    expect(workflowNodeCountLabel(0)).toBe('0 节点')
    expect(workflowNodeCountLabel(2)).toBe('2 节点')
  })
})
