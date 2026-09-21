import "antd/dist/reset.css"
import "@/features/infinite-canvas/styles/design-system.css"
import "@/features/infinite-canvas/canvas.css"
import "reactflow/dist/style.css"

import { useEffect, useState } from "react"
import ReactFlow, { Background, ReactFlowProvider } from "reactflow"
import NodeGenerateBar from "@/features/infinite-canvas/components/NodeGenerateBar"
import ImageConfigNode from "@/features/infinite-canvas/components/nodes/ImageConfigNode"
import VideoConfigNode from "@/features/infinite-canvas/components/nodes/VideoConfigNode"
import { useCanvasStore } from "@/features/infinite-canvas/stores/canvasStore"
import { cn } from "@/lib/utils"

const nodeTypes = {
  imageConfig: ImageConfigNode,
  videoConfig: VideoConfigNode,
}

function PreviewInner() {
  const nodes = useCanvasStore((state) => state.nodes)
  const onNodesChange = useCanvasStore((state) => state.onNodesChange)
  const addNode = useCanvasStore((state) => state.addNode)
  const selectNode = useCanvasStore((state) => state.selectNode)
  const clearCanvas = useCanvasStore((state) => state.clearCanvas)
  const [imageId, setImageId] = useState<string | null>(null)
  const [videoId, setVideoId] = useState<string | null>(null)
  const selectedId = nodes.find((node) => Boolean((node as { selected?: boolean }).selected))?.id

  useEffect(() => {
    clearCanvas()
    const nextImageId = addNode("imageConfig", { x: 120, y: 80 }, { model: "gpt-image-2", n: 1 })
    const nextVideoId = addNode(
      "videoConfig",
      { x: 520, y: 80 },
      { model: "happyhorse-1.1-i2v", size: "1280*720", resolution: "720P", duration: 5 }
    )
    setImageId(nextImageId)
    setVideoId(nextVideoId)
    selectNode(nextVideoId)
    return () => clearCanvas()
  }, [addNode, clearCanvas, selectNode])

  return (
    <div className="relative h-screen overflow-hidden bg-[hsl(var(--surface))]">
      <div className="absolute left-4 top-4 z-30 flex items-center gap-2 rounded-full bg-[hsl(var(--surface-container-lowest))]/95 px-2 py-1.5 shadow-sm">
        <p className="px-2 text-[11px] font-semibold tracking-wide text-[hsl(var(--secondary))]">
          DEV · 生成栏
        </p>
        <button
          type="button"
          onClick={() => imageId && selectNode(imageId)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            selectedId === imageId
              ? "signature-gradient text-white"
              : "bg-[hsl(var(--surface-container-high))] text-[hsl(var(--on-surface))]"
          )}
        >
          画面节点
        </button>
        <button
          type="button"
          onClick={() => videoId && selectNode(videoId)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            selectedId === videoId
              ? "signature-gradient text-white"
              : "bg-[hsl(var(--surface-container-high))] text-[hsl(var(--on-surface))]"
          )}
        >
          视频节点
        </button>
      </div>
      <ReactFlow
        nodes={nodes}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        className="h-full w-full"
      >
        <Background gap={20} size={1} />
      </ReactFlow>
      <NodeGenerateBar />
    </div>
  )
}

export default function GenerateDockPreview() {
  return (
    <ReactFlowProvider>
      <PreviewInner />
    </ReactFlowProvider>
  )
}
