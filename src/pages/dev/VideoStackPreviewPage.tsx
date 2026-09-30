import 'antd/dist/reset.css'
import '@/features/infinite-canvas/styles/design-system.css'
import '@/features/infinite-canvas/canvas.css'
import 'reactflow/dist/style.css'

import { useEffect } from 'react'
import ReactFlow, { Background, ReactFlowProvider } from 'reactflow'
import VideoConfigNode from '@/features/infinite-canvas/components/nodes/VideoConfigNode'
import { useCanvasStore } from '@/features/infinite-canvas/stores/canvasStore'

const nodeTypes = {
  videoConfig: VideoConfigNode,
}

function paintStill(label: string, color: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 720
  const context = canvas.getContext('2d')
  if (!context) return ''
  context.fillStyle = color
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#ffffff'
  context.font = '700 280px sans-serif'
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
    const stills = ['1', '2', '3', '4'].map((label, index) =>
      paintStill(label, ['#9a3412', '#1d4ed8', '#15803d', '#a16207'][index] || '#444'),
    )
    const clips = stills.map((_, index) => `https://cdn.example/stack-${index + 1}.mp4`)
    clearCanvas()
    addNode('videoConfig', { x: 40, y: 80 }, {
      label: '单条',
      url: clips[0],
      thumbnail: stills[0],
      videoUrls: undefined,
      thumbnailUrls: undefined,
      activeVideoIndex: undefined,
      n: 1,
      size: '1280*720',
      resolution: '720P',
      ratio: '16:9',
      width: 1280,
      height: 720,
    })
    addNode('videoConfig', { x: 560, y: 80 }, {
      label: '两条叠放',
      url: clips[0],
      thumbnail: stills[0],
      videoUrls: clips.slice(0, 2),
      thumbnailUrls: stills.slice(0, 2),
      activeVideoIndex: 0,
      n: 2,
      size: '1280*720',
      resolution: '720P',
      ratio: '16:9',
      width: 1280,
      height: 720,
    })
    addNode('videoConfig', { x: 1080, y: 80 }, {
      label: '四条叠放',
      url: clips[0],
      thumbnail: stills[0],
      videoUrls: clips,
      thumbnailUrls: stills,
      activeVideoIndex: 0,
      n: 4,
      size: '1280*720',
      resolution: '720P',
      ratio: '16:9',
      width: 1280,
      height: 720,
    })
    return () => clearCanvas()
  }, [addNode, clearCanvas])

  return (
    <div className="relative h-screen overflow-hidden bg-[hsl(var(--surface))]">
      <div className="pointer-events-none absolute left-4 top-4 z-30 rounded-xl bg-[hsl(var(--surface-container-lowest))]/90 px-3 py-2 text-xs text-[hsl(var(--secondary))] shadow-sm">
        DEV · 视频节点多条叠放。单击右下角候选置顶，节点 url 跟随前置那条。
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

export default function VideoStackPreviewPage() {
  return (
    <ReactFlowProvider>
      <PreviewInner />
    </ReactFlowProvider>
  )
}
