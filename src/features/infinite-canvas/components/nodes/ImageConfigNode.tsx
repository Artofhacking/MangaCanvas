import React, { useState, useCallback } from 'react';
import { Position, NodeProps } from 'reactflow';
import { message } from 'antd';
import { Copy, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useCanvasStore } from '../../stores/canvasStore';
import type { CustomNode } from '../../types';
import { PlusHandle } from './PlusHandle';
import {
  IMAGE_PREVIEW_WIDTH,
  MediaEmptyGlyph,
  MediaPreviewCard,
  cssAspectRatio,
} from './MediaPreviewCard';

const ImageConfigNode: React.FC<NodeProps<CustomNode['data']>> = ({ id, data, selected }) => {
  const { updateNode, duplicateNode, removeNode } = useCanvasStore(
    useShallow((state) => ({
      updateNode: state.updateNode,
      duplicateNode: state.duplicateNode,
      removeNode: state.removeNode,
    }))
  );
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label || '画面节点');

  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditLabel(data.label || '画面节点');
    setIsEditingLabel(true);
  }, [data.label]);

  const handleLabelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditLabel(e.target.value);
  }, []);

  const handleLabelBlur = useCallback(() => {
    setIsEditingLabel(false);
    if (editLabel.trim() && editLabel !== data.label) {
      updateNode(id, { label: editLabel.trim(), isLabelCustomized: true });
    }
  }, [editLabel, data.label, id, updateNode]);

  const handleLabelKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLabelBlur();
    } else if (e.key === 'Escape') {
      setIsEditingLabel(false);
      setEditLabel(data.label || '画面节点');
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
      label={data.label || '画面节点'}
      icon={<ImageIcon />}
      width={IMAGE_PREVIEW_WIDTH}
      aspectRatio={cssAspectRatio(typeof data.ratio === 'string' ? data.ratio : undefined, '1 / 1')}
      isEditingLabel={isEditingLabel}
      editLabel={editLabel}
      onLabelDoubleClick={handleLabelDoubleClick}
      onLabelChange={handleLabelChange}
      onLabelBlur={handleLabelBlur}
      onLabelKeyDown={handleLabelKeyDown}
      handles={
        <>
          <PlusHandle type="target" position={Position.Left} />
          <PlusHandle type="source" position={Position.Right} />
        </>
      }
      actions={[
        { key: 'duplicate', label: '复制', icon: <Copy className="h-4 w-4" />, onClick: handleDuplicate },
        { key: 'delete', label: '删除', icon: <Trash2 className="h-4 w-4" />, onClick: handleDelete, danger: true },
      ]}
    >
      <MediaEmptyGlyph kind="image" />
    </MediaPreviewCard>
  );
};

export default ImageConfigNode;
