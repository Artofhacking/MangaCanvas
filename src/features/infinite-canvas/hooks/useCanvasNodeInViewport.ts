import { useStore } from 'reactflow'
import { flowNodeIntersectsViewport } from '../utils/canvasMediaBudget'

/**
 * True when the measured node overlaps the pane.
 * Unmeasured nodes return true so the first paint is not stuck blank; media
 * decode is still capped separately.
 */
export function useCanvasNodeInViewport(nodeId: string, minVisibleRatio: number): boolean {
  return useStore((state) => {
    const node = state.nodeInternals.get(nodeId)
    const width = node?.width
    const height = node?.height
    if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
      return true
    }
    if (state.width <= 0 || state.height <= 0) return true
    const [translateX, translateY, zoom] = state.transform
    return flowNodeIntersectsViewport({
      nodeX: node?.positionAbsolute?.x ?? node?.position.x ?? 0,
      nodeY: node?.positionAbsolute?.y ?? node?.position.y ?? 0,
      nodeWidth: width,
      nodeHeight: height,
      translateX,
      translateY,
      zoom,
      paneWidth: state.width,
      paneHeight: state.height,
      minVisibleRatio,
    })
  })
}
