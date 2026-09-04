import "antd/dist/reset.css"
import "@/features/infinite-canvas/styles/design-system.css"
import "@/features/infinite-canvas/canvas.css"

import Canvas from "@/features/infinite-canvas/Canvas"
import ErrorBoundary from "@/components/ErrorBoundary"

export default function WorkflowCanvas() {
  return (
    <ErrorBoundary>
      <Canvas />
    </ErrorBoundary>
  )
}
