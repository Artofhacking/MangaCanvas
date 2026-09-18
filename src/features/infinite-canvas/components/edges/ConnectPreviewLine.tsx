import React from 'react'
import { ConnectionLineComponentProps, getBezierPath } from 'reactflow'

const ConnectPreviewLine: React.FC<ConnectionLineComponentProps> = ({
  fromX,
  fromY,
  fromPosition,
  toX,
  toY,
  toPosition,
}) => {
  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  })

  return (
    <g className="react-flow__connection">
      <path
        d={path}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        className="react-flow__connection-path"
      />
    </g>
  )
}

export default ConnectPreviewLine
