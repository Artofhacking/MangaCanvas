import { describe, expect, it } from 'vitest'

import {
  EPISODE_ROW_ACTION_LABELS,
  EPISODE_ROW_ACTIONS,
  WORKFLOW_ROW_ACTIONS,
  copiedWorkflowName,
  planBlankWorkflow,
  planWorkflowCopy,
} from './canvasProjectMenu'

describe('planBlankWorkflow', () => {
  it('creates a project-level local draft when the canvas is not bound to an episode', () => {
    expect(planBlankWorkflow({
      sourceType: 'scene',
      sourceAssetId: 4,
      existingNames: ['空白工作流'],
    })).toEqual({
      name: '空白工作流',
      sourceType: 'blank',
      sourceAssetId: undefined,
      persist: 'local-draft',
    })
  })

  it('binds a blank draft to the open episode and avoids a duplicate name', () => {
    expect(planBlankWorkflow({
      sourceType: 'episode',
      sourceAssetId: 9,
      episodeName: '第一集',
      existingNames: ['第一集 工作流', '第一集 工作流 2'],
    })).toEqual({
      name: '第一集 工作流 3',
      sourceType: 'episode',
      sourceAssetId: 9,
      persist: 'local-draft',
    })
  })

  it('prefers the route episode id over a different workflow binding', () => {
    expect(planBlankWorkflow({
      routeEpisodeId: '3',
      sourceType: 'episode',
      sourceAssetId: 9,
      episodeName: '第三集',
      existingNames: [],
    })).toMatchObject({
      name: '第三集 工作流',
      sourceType: 'episode',
      sourceAssetId: 3,
      persist: 'local-draft',
    })
  })
})

describe('planWorkflowCopy', () => {
  it('keeps an empty copy off the server and names it once', () => {
    expect(planWorkflowCopy(0)).toBe('local-draft')
    expect(copiedWorkflowName('办公室', ['办公室'])).toBe('办公室 (复制)')
    expect(copiedWorkflowName('办公室', ['办公室', '办公室 (复制)'])).toBe('办公室 (复制 2)')
  })

  it('copies a canvas that already has nodes onto the server', () => {
    expect(planWorkflowCopy(2)).toBe('server')
  })

  it('does not treat a missing node count as empty', () => {
    expect(planWorkflowCopy(undefined)).toBe('needs-detail')
  })
})

describe('canvas project menu actions', () => {
  it('offers workflow rename, copy, and delete', () => {
    expect(WORKFLOW_ROW_ACTIONS).toEqual(['rename', 'copy', 'delete'])
  })

  it('does not offer episode delete from this menu', () => {
    expect(EPISODE_ROW_ACTIONS).toEqual(['rename', 'open-in-episodes'])
    expect(Object.values(EPISODE_ROW_ACTION_LABELS)).not.toContain('删除')
  })
})
