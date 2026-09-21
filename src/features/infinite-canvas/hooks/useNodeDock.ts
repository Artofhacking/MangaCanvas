import { useCanvasStore } from '../stores/canvasStore'
import { useStore, type Node as RFNode } from 'reactflow'
import {
  exactlySelectedNodeId,
  type NodeDockAnchor,
} from '../utils/nodeDock'

export function useExactlySelectedNodeId(
  match: (type?: string | null) => boolean
): string | null {
  return useCanvasStore((state) => exactlySelectedNodeId(state.nodes, match))
}

export function useNodeDockAnchor(nodeId: string | null): NodeDockAnchor | null {
  return useStore((state) => {
    if (!nodeId) return null
    const node = state.nodeInternals.get(nodeId) as
      | (RFNode & { measured?: { width?: number; height?: number } })
      | undefined
    if (!node) return null
    const [translateX, translateY, zoom] = state.transform
    const abs = node.positionAbsolute ?? node.position
    const width = node.width ?? node.measured?.width ?? 360
    const height = node.height ?? node.measured?.height ?? Math.round(width * 0.85)
    return {
      id: nodeId,
      left: abs.x * zoom + translateX,
      top: abs.y * zoom + translateY,
      width: width * zoom,
      height: height * zoom,
    }
  })
}
