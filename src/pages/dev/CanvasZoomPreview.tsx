import 'antd/dist/reset.css'
import '@/features/infinite-canvas/styles/design-system.css'
import '@/features/infinite-canvas/canvas.css'
import 'reactflow/dist/style.css'

import { useEffect } from 'react'
import ReactFlow, { Background, ReactFlowProvider } from 'reactflow'
import { CanvasZoomControls } from '@/features/infinite-canvas/components/CanvasZoomControls'
import TextNode from '@/features/infinite-canvas/components/nodes/TextNode'
import { useCanvasStore } from '@/features/infinite-canvas/stores/canvasStore'

const nodeTypes = {
  text: TextNode,
}

function PreviewInner() {
  const nodes = useCanvasStore((state) => state.nodes)
  const onNodesChange = useCanvasStore((state) => state.onNodesChange)
  const addNode = useCanvasStore((state) => state.addNode)
  const clearCanvas = useCanvasStore((state) => state.clearCanvas)

  useEffect(() => {
    clearCanvas()
    addNode('text', { x: 80, y: 80 }, { content: '缩放百分比应跟随 + / − / 滚轮即时更新。' })
    addNode('text', { x: 520, y: 280 }, { content: '窗口缩放不会自动 fitView。' })
    return () => clearCanvas()
  }, [addNode, clearCanvas])

  return (
    <div className="relative h-screen overflow-hidden bg-[hsl(var(--surface))]">
      <div className="pointer-events-none absolute left-4 top-4 z-30 rounded-xl bg-[hsl(var(--surface-container-lowest))]/90 px-3 py-2 text-xs text-[hsl(var(--secondary))] shadow-sm">
        DEV · 画布缩放百分比
      </div>
      <ReactFlow
        nodes={nodes}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="h-full w-full"
      >
        <Background gap={20} size={1} />
      </ReactFlow>
      <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-[20px] border border-[hsl(var(--outline-variant))]/40 bg-[hsl(var(--surface-container-lowest))]/90 p-1.5 shadow-xl shadow-black/5 backdrop-blur-md">
        <CanvasZoomControls />
      </div>
    </div>
  )
}

export default function CanvasZoomPreview() {
  return (
    <ReactFlowProvider>
      <PreviewInner />
    </ReactFlowProvider>
  )
}
