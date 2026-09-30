import 'antd/dist/reset.css'
import '@/features/infinite-canvas/styles/design-system.css'
import '@/features/infinite-canvas/canvas.css'
import 'reactflow/dist/style.css'

import { useEffect } from 'react'
import ReactFlow, { Background, ReactFlowProvider } from 'reactflow'
import ImageConfigNode from '@/features/infinite-canvas/components/nodes/ImageConfigNode'
import { useCanvasStore } from '@/features/infinite-canvas/stores/canvasStore'

const nodeTypes = {
  imageConfig: ImageConfigNode,
}

function paintCard(label: string, color: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 1024
  const context = canvas.getContext('2d')
  if (!context) return ''
  context.fillStyle = color
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#ffffff'
  context.font = '700 220px sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(label, canvas.width / 2, canvas.height / 2)
  return canvas.toDataURL('image/jpeg', 0.85)
}

function PreviewInner() {
  const nodes = useCanvasStore((state) => state.nodes)
  const onNodesChange = useCanvasStore((state) => state.onNodesChange)
  const addNode = useCanvasStore((state) => state.addNode)
  const clearCanvas = useCanvasStore((state) => state.clearCanvas)

  useEffect(() => {
    const one = paintCard('1', '#c2410c')
    const cards = ['1', '2', '3', '4'].map((label, index) => paintCard(label, ['#c2410c', '#1d4ed8', '#15803d', '#a16207'][index] || '#444'))
    clearCanvas()
    addNode('imageConfig', { x: 40, y: 40 }, {
      label: '单张',
      url: one,
      imageUrls: undefined,
      activeImageIndex: undefined,
      size: '768x1024',
      ratio: '3:4',
      width: 768,
      height: 1024,
    })
    addNode('imageConfig', { x: 560, y: 40 }, {
      label: '两张叠放',
      url: cards[0],
      imageUrls: cards.slice(0, 2),
      activeImageIndex: 0,
      n: 2,
      size: '768x1024',
      ratio: '3:4',
      width: 768,
      height: 1024,
    })
    addNode('imageConfig', { x: 1080, y: 40 }, {
      label: '四张叠放',
      url: cards[0],
      imageUrls: cards,
      activeImageIndex: 0,
      n: 4,
      size: '768x1024',
      ratio: '3:4',
      width: 768,
      height: 1024,
    })
    return () => clearCanvas()
  }, [addNode, clearCanvas])

  return (
    <div className="relative h-screen overflow-hidden bg-[hsl(var(--surface))]">
      <div className="pointer-events-none absolute left-4 top-4 z-30 rounded-xl bg-[hsl(var(--surface-container-lowest))]/90 px-3 py-2 text-xs text-[hsl(var(--secondary))] shadow-sm">
        DEV · 画面节点多图叠放。单击右下角候选图置顶。
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
    </div>
  )
}

export default function ImageStackPreviewPage() {
  return (
    <ReactFlowProvider>
      <PreviewInner />
    </ReactFlowProvider>
  )
}
