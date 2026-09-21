import { describe, expect, it } from 'vitest'
import { hasStarterWorkflowTemplates, WORKFLOW_TEMPLATES } from './workflows'

const UNRELATED_DEMO_IDS = [
  'text-to-image-basic',
  'image-to-image-basic',
  'image-to-video-basic',
  'video-effect-basic',
]

const UNRELATED_DEMO_MARKERS = /春节|春联|熊猫|甜甜圈|萌宠|元旦快乐|新年快乐|胖乎乎大熊猫/

describe('WORKFLOW_TEMPLATES', () => {
  it('does not expose the generic AI-toy starter demos', () => {
    const ids = WORKFLOW_TEMPLATES.map((template) => template.id)
    for (const id of UNRELATED_DEMO_IDS) {
      expect(ids).not.toContain(id)
    }
  })

  it('does not recommend unrelated CNY / pet / toy demo copy', () => {
    for (const template of WORKFLOW_TEMPLATES) {
      const haystack = [template.id, template.name, template.description].join(' ')
      expect(haystack).not.toMatch(UNRELATED_DEMO_MARKERS)

      const graph = template.createNodes({ x: 0, y: 0 })
      const nodeCopy = graph.nodes
        .map((node) => JSON.stringify(node.data ?? {}))
        .join(' ')
      expect(nodeCopy).not.toMatch(UNRELATED_DEMO_MARKERS)
    }
  })

  it('hides the starter gallery while no 漫剧 templates exist', () => {
    expect(hasStarterWorkflowTemplates()).toBe(WORKFLOW_TEMPLATES.length > 0)
    expect(WORKFLOW_TEMPLATES).toEqual([])
  })
})
