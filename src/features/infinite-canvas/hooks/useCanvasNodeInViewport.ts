import { useStore } from 'reactflow'
import { flowNodeIntersectsViewport } from '../utils/canvasMediaBudget'

/**
 * True when the measured node overlaps the pane.
 * Unmeasured nodes return false. React Flow mounts those nodes on the opening
 * frame (`onlyRenderVisibleElements` treats missing dimensions as visible),
 * and treating them as in-view decoded every image before fitView.
 */
export function useCanvasNodeInViewport(nodeId: string, minVisibleRatio: number): boolean {
  return useStore((state) => {
    const node = state.nodeInternals.get(nodeId)
    const width = node?.width
    const height = node?.height
    if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
      return false
    }
    if (state.width <= 0 || state.height <= 0) return false
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
