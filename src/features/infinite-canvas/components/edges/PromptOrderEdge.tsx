import React from 'react';
import { BaseEdge, getBezierPath, EdgeProps } from 'reactflow';
import type { CustomEdge } from '../../types';

const PromptOrderEdge: React.FC<EdgeProps<CustomEdge['data']>> = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
}) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <BaseEdge path={edgePath} markerEnd={markerEnd} />
  );
};

export default PromptOrderEdge;
