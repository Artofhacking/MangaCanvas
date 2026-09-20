import React, { useCallback } from 'react';
import { BaseEdge, EdgeProps, getBezierPath, useStore } from 'reactflow';
import type { CustomEdge } from '../../types';

const ACTIVE_STROKE = 'var(--ic-primary, hsl(var(--primary)))';

const CanvasFlowEdge: React.FC<EdgeProps<CustomEdge['data']>> = ({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  selected,
  interactionWidth,
}) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const isAdjacentSelected = useStore(
    useCallback(
      (state) =>
        state.nodes.some(
          (node) => node.selected && (node.id === source || node.id === target)
        ),
      [source, target]
    )
  );

  const isActive = isAdjacentSelected || Boolean(selected);
  const particlePath = `path('${edgePath}')`;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={interactionWidth}
        style={{
          ...style,
          ...(isActive
            ? {
                stroke: ACTIVE_STROKE,
                strokeWidth: 2.25,
              }
            : null),
        }}
      />
      {isActive ? (
        <>
          <path d={edgePath} className="canvas-edge-flow" fill="none" aria-hidden />
          <circle
            r="3.25"
            className="canvas-edge-particle canvas-edge-particle--trail"
            style={{ offsetPath: particlePath }}
            aria-hidden
          />
          <circle
            r="3.25"
            className="canvas-edge-particle"
            style={{ offsetPath: particlePath }}
            aria-hidden
          />
        </>
      ) : null}
    </>
  );
};

export default CanvasFlowEdge;
