import React, { useEffect, useRef, useState } from 'react'
import { computeNodeDockPosition } from '../utils/nodeDock'
import { useNodeDockAnchor } from '../hooks/useNodeDock'

interface NodeDockOverlayProps {
  nodeId: string | null
  barWidth: number
  estimatedHeight: number
  dockKey: 'generate' | 'text-edit'
  children?: React.ReactNode | ((ctx: { placeAbove: boolean }) => React.ReactNode)
}

export function NodeDockOverlay({
  nodeId,
  barWidth,
  estimatedHeight,
  dockKey,
  children,
}: NodeDockOverlayProps) {
  const anchor = useNodeDockAnchor(nodeId)
  const overlayRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [barSize, setBarSize] = useState({ width: barWidth, height: estimatedHeight })

  useEffect(() => {
    const element = barRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setBarSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [nodeId])

  if (!nodeId || !anchor || !children) {
    return <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-20" />
  }

  const containerWidth = overlayRef.current?.clientWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1280)
  const containerHeight = overlayRef.current?.clientHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 720)
  const { left, top, placeAbove } = computeNodeDockPosition(
    anchor,
    barSize,
    { width: containerWidth, height: containerHeight }
  )

  return (
    <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-20">
      <div
        ref={barRef}
        className="pointer-events-auto absolute nodrag nowheel nopan"
        data-node-dock={dockKey}
        data-generate-bar={dockKey === 'generate' ? 'true' : undefined}
        style={{ left, top, width: barWidth }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {typeof children === 'function' ? children({ placeAbove }) : children}
      </div>
    </div>
  )
}

export default NodeDockOverlay
