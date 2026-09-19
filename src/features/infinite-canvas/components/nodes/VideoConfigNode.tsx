import React, { useState, useCallback, useMemo } from 'react';
import { Position, NodeProps } from 'reactflow';
import { message } from 'antd';
import { Copy, Trash2, Video } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useCanvasStore } from '../../stores/canvasStore';
import { remapVideoModel } from '../../config/models';
import { isKF2VModel } from '@/api/aigc';
import type { CustomNode } from '../../types';
import { PlusHandle } from './PlusHandle';
import {
  MediaEmptyGlyph,
  MediaPreviewCard,
  VIDEO_PREVIEW_WIDTH,
  cssAspectRatio,
} from './MediaPreviewCard';

const VideoConfigNode: React.FC<NodeProps<CustomNode['data']>> = ({ id, data, selected }) => {
  const { updateNode, duplicateNode, removeNode } = useCanvasStore(
    useShallow((state) => ({
      updateNode: state.updateNode,
      duplicateNode: state.duplicateNode,
      removeNode: state.removeNode,
    }))
  );
  const isKF2V = useMemo(
    () => isKF2VModel(remapVideoModel(typeof data.model === 'string' ? data.model : undefined)),
    [data.model]
  );
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label || '视频节点');

  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditLabel(data.label || '视频节点');
    setIsEditingLabel(true);
  }, [data.label]);

  const handleLabelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditLabel(e.target.value);
  }, []);

  const handleLabelBlur = useCallback(() => {
    setIsEditingLabel(false);
    if (editLabel.trim() && editLabel !== data.label) {
      updateNode(id, { label: editLabel.trim() });
    }
  }, [editLabel, data.label, id, updateNode]);

  const handleLabelKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLabelBlur();
    } else if (e.key === 'Escape') {
      setIsEditingLabel(false);
      setEditLabel(data.label || '视频节点');
    }
  }, [handleLabelBlur, data.label]);

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateNode(id);
    message.success('节点已复制');
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeNode(id);
  };

  return (
    <MediaPreviewCard
      selected={selected}
      label={data.label || '视频节点'}
      icon={<Video />}
      width={VIDEO_PREVIEW_WIDTH}
      aspectRatio={cssAspectRatio(typeof data.ratio === 'string' ? data.ratio : undefined, '16 / 9')}
      isEditingLabel={isEditingLabel}
      editLabel={editLabel}
      onLabelDoubleClick={handleLabelDoubleClick}
      onLabelChange={handleLabelChange}
      onLabelBlur={handleLabelBlur}
      onLabelKeyDown={handleLabelKeyDown}
      handles={
        isKF2V ? (
          <>
            <PlusHandle type="target" position={Position.Left} id="prompt" title="提示词" />
            <PlusHandle
              type="target"
              position={Position.Left}
              id="first-frame"
              title="首帧"
              style={{ top: '58%' }}
            />
            <PlusHandle
              type="target"
              position={Position.Left}
              id="last-frame"
              title="尾帧"
              style={{ top: '78%' }}
            />
            <PlusHandle type="source" position={Position.Right} />
          </>
        ) : (
          <>
            <PlusHandle type="target" position={Position.Left} />
            <PlusHandle type="source" position={Position.Right} />
          </>
        )
      }
      actions={[
        { key: 'duplicate', label: '复制', icon: <Copy className="h-4 w-4" />, onClick: handleDuplicate },
        { key: 'delete', label: '删除', icon: <Trash2 className="h-4 w-4" />, onClick: handleDelete, danger: true },
      ]}
    >
      <MediaEmptyGlyph kind="video" />
    </MediaPreviewCard>
  );
};

export default VideoConfigNode;
