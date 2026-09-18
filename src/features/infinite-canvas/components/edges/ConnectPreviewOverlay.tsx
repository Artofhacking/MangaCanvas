import React from 'react'
import { buildScreenBezier } from '../../utils/connectPreview'

const ConnectPreviewOverlay: React.FC<{
  from: { x: number; y: number }
  to: { x: number; y: number }
}> = ({ from, to }) => {
  return (
    <svg
      className="pointer-events-none fixed inset-0 z-[35] h-full w-full overflow-visible"
      aria-hidden
    >
      <path
        d={buildScreenBezier(from, to)}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        className="react-flow__connection-path"
      />
      <circle cx={to.x} cy={to.y} r={4} fill="hsl(var(--primary))" />
    </svg>
  )
}

export default ConnectPreviewOverlay
