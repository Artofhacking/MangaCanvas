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
        Boolean(
          state.nodeInternals.get(source)?.selected ||
            state.nodeInternals.get(target)?.selected
        ),
      [source, target]
    )
  );

  const isActive = isAdjacentSelected || Boolean(selected);

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
                stroke: `color-mix(in srgb, ${ACTIVE_STROKE} 42%, transparent)`,
                strokeWidth: 2,
              }
            : null),
        }}
      />
      {isActive ? (
        <>
          <path d={edgePath} className="canvas-edge-flow" fill="none" aria-hidden />
          <circle r="3" className="canvas-edge-particle canvas-edge-particle--trail" aria-hidden>
            <animateMotion dur="1.2s" begin="-0.4s" repeatCount="indefinite" path={edgePath} />
          </circle>
          <circle r="3.75" className="canvas-edge-particle" aria-hidden>
            <animateMotion dur="1.2s" repeatCount="indefinite" path={edgePath} />
          </circle>
        </>
      ) : null}
    </>
  );
};

export default CanvasFlowEdge;
