import { useCanvasStore } from '../stores/canvasStore'
import type { GenerateNodeType } from './generateSlots'
import { requestTextEditFocus } from './textEditFocus'
import type { NodeData } from '../types'

export function spawnGenerateFromSource(
  sourceId: string,
  type: GenerateNodeType,
  position: { x: number; y: number }
): string | null {
  const { nodes, addNode, addEdgeManually, selectNode } = useCanvasStore.getState()
  const source = nodes.find((node) => node.id === sourceId)
  if (!source) return null

  // Incoming edges still create numbered reference slots. Leave the prompt empty
  // so a new 画面节点 does not auto-insert @1 before the user types.
  const data: Partial<NodeData> = {}
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

/** Create an empty text note linked from the source node and focus its edit bar. */
export function spawnTextNoteFromSource(
  sourceId: string,
  position: { x: number; y: number }
): string | null {
  const { nodes, addNode, addEdgeManually, selectNode } = useCanvasStore.getState()
  const source = nodes.find((node) => node.id === sourceId)
  if (!source) return null

  const id = addNode('text', position)
  addEdgeManually({ source: sourceId, target: id, targetHandle: 'left' })
  selectNode(id)
  requestTextEditFocus(id)
  return id
}
