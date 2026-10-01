import { useEffect, useRef } from 'react'
import ReactFlow, { Background, ReactFlowProvider } from 'reactflow'
import 'reactflow/dist/style.css'
import 'antd/dist/reset.css'
import '@/features/infinite-canvas/styles/design-system.css'
import '@/features/infinite-canvas/canvas.css'
import { useCanvasStore } from '@/features/infinite-canvas/stores/canvasStore'
import AudioNode from '@/features/infinite-canvas/components/nodes/AudioNode'
import TextNode from '@/features/infinite-canvas/components/nodes/TextNode'
import NodeGenerateBar from '@/features/infinite-canvas/components/NodeGenerateBar'

const nodeTypes = {
  audio: AudioNode,
  text: TextNode,
}

/** Short offline tone so the preview can play without an upload service. */
function toneDataUrl(): string {
  const sampleRate = 8000
  const length = Math.floor(sampleRate * 2.4)
  const buffer = new ArrayBuffer(44 + length * 2)
  const view = new DataView(buffer)
  const write = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index))
  }
  write(0, 'RIFF')
  view.setUint32(4, 36 + length * 2, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, length * 2, true)
  for (let index = 0; index < length; index += 1) {
    const sample = Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 0.25
    view.setInt16(44 + index * 2, sample * 32767, true)
  }
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index])
  return `data:audio/wav;base64,${btoa(binary)}`
}

function AudioNodePreviewInner() {
  const seeded = useRef(false)
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, addEdgeManually, selectNode, clearCanvas } =
    useCanvasStore()

  useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    clearCanvas()
    const emptyId = addNode('audio', { x: 80, y: 80 })
    const textId = addNode('text', { x: 80, y: 420 }, { content: '夜色里的一句旁白。' })
    addEdgeManually({ source: textId, target: emptyId })
    addNode('audio', { x: 560, y: 80 }, {
      label: '已上传旁白',
      url: toneDataUrl(),
      audioMode: 'tts',
    })
    selectNode(emptyId)
  }, [addEdgeManually, addNode, clearCanvas, selectNode])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[hsl(var(--surface))]">
      <div className="pointer-events-none absolute left-4 top-4 z-30 rounded-xl bg-[hsl(var(--surface-container-lowest))]/90 px-3 py-2 text-xs text-[hsl(var(--secondary))] shadow-sm">
        DEV · 音频节点：模式、上传、播放、生成栏
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
    </div>
  )
}

export default function AudioNodePreview() {
  return (
    <ReactFlowProvider>
      <AudioNodePreviewInner />
    </ReactFlowProvider>
  )
}
