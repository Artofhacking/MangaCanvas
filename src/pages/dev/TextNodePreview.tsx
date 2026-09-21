import { useEffect, useRef } from 'react'
import ReactFlow, { Background, ReactFlowProvider } from 'reactflow'
import 'reactflow/dist/style.css'
import 'antd/dist/reset.css'
import '@/features/infinite-canvas/styles/design-system.css'
import '@/features/infinite-canvas/canvas.css'
import { useCanvasStore } from '@/features/infinite-canvas/stores/canvasStore'
import TextNode from '@/features/infinite-canvas/components/nodes/TextNode'
import ImageConfigNode from '@/features/infinite-canvas/components/nodes/ImageConfigNode'
import NodeGenerateBar from '@/features/infinite-canvas/components/NodeGenerateBar'
import TextEditBar from '@/features/infinite-canvas/components/TextEditBar'

const nodeTypes = {
  text: TextNode,
  imageConfig: ImageConfigNode,
}

function TextNodePreviewInner() {
  const seeded = useRef(false)
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, selectNode, clearCanvas } =
    useCanvasStore()

  useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    clearCanvas()
    const emptyId = addNode('text', { x: 120, y: 80 })
    addNode('text', { x: 500, y: 80 }, { content: '屋顶上看星星的旁白。' })
    addNode('imageConfig', { x: 120, y: 460 })
    selectNode(emptyId)
  }, [addNode, clearCanvas, selectNode])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[hsl(var(--surface))]">
      <div className="pointer-events-none absolute left-4 top-4 z-30 rounded-xl bg-[hsl(var(--surface-container-lowest))]/90 px-3 py-2 text-xs text-[hsl(var(--secondary))] shadow-sm">
        DEV · 文本节点双表面预览
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        minZoom={0.4}
        maxZoom={1.6}
        defaultViewport={{ x: 40, y: 20, zoom: 1 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} />
      </ReactFlow>
      <NodeGenerateBar />
      <TextEditBar />
    </div>
  )
}

export default function TextNodePreview() {
  return (
    <ReactFlowProvider>
      <TextNodePreviewInner />
    </ReactFlowProvider>
  )
}
