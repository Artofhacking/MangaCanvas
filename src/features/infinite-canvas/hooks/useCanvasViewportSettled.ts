import { useStore } from 'reactflow'
import { isCanvasFitViewSettled } from '../utils/canvasMediaBudget'

/** False on the pre-fitView frame, including the saved zoom before fit-all commits. */
export function useCanvasViewportSettled(): boolean {
  return useStore((state) => isCanvasFitViewSettled(state as { fitViewOnInitDone?: boolean }))
}
