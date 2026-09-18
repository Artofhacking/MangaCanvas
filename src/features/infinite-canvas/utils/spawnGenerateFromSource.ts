import { useCanvasStore } from '../stores/canvasStore'
import type { GenerateNodeType } from './generateSlots'
import type { NodeData } from '../types'

export function spawnGenerateFromSource(
  sourceId: string,
  type: GenerateNodeType,
  position: { x: number; y: number }
): string | null {
  const { nodes, addNode, addEdgeManually, selectNode } = useCanvasStore.getState()
  const source = nodes.find((node) => node.id === sourceId)
  if (!source) return null

  const data: Partial<NodeData> = { prompt: '@1 ' }
  if (source.type === 'image') {
    if (type === 'imageConfig') {
      data.label = '图生图'
      data.model = 'wan2.6-image'
    } else {
      data.label = '图生视频'
      data.model = 'happyhorse-1.1-i2v'
      data.size = '1280*720'
      data.resolution = '720P'
      data.duration = 5
    }
  }

  const id = addNode(type, position, data)
  addEdgeManually({ source: sourceId, target: id })
  selectNode(id)
  return id
}
