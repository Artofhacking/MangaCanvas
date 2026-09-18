import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { message, Input } from 'antd';
import { CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import { useShallow } from 'zustand/react/shallow';
import { useCanvasStore } from '../../stores/canvasStore';
import type { CustomNode } from '../../types';

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

  const handleLabelKeyDown = useCallback((e: React.KeyboardEvent) => {
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
    <div className="relative">
      <div
        className={`rounded-lg shadow-lg border-2 ${
          selected ? 'border-[hsl(var(--primary))] shadow-[0_0_0_1px_rgba(172,46,0,0.24)]' : 'border-[var(--border-color)]'
        } min-w-[260px] transition-colors relative`}
        style={{
          backgroundColor: 'var(--bg-primary, var(--ic-surface-container-lowest, #ffffff))',
          borderColor: selected ? undefined : 'var(--border-color, var(--ic-outline-variant, rgba(26,26,26,0.18)))',
        }}
      >
        <Handle type="target" position={Position.Left} className="!bg-[hsl(var(--primary))]" />
        <Handle type="source" position={Position.Right} className="!bg-[hsl(var(--primary))]" />

        <div
          className={`px-4 py-2 font-semibold rounded-t-md flex items-center justify-between ${
            selected ? 'text-white' : ''
          }`}
          style={selected ? { background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, #d73b00 100%)' } : { backgroundColor: 'var(--bg-secondary, var(--ic-surface-container-low, #f4efe9))', color: 'var(--text-primary, var(--ic-on-surface, #1f1f1f))' }}
        >
          {isEditingLabel ? (
            <Input
              value={editLabel}
              onChange={handleLabelChange}
              onBlur={handleLabelBlur}
              onKeyDown={handleLabelKeyDown}
              autoFocus
              size="small"
              className="nodrag w-32 text-sm"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="cursor-pointer hover:opacity-80"
              onDoubleClick={handleLabelDoubleClick}
              title="双击编辑"
            >
              🎨 {data.label || '画面节点'}
            </span>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={handleDelete}
              className="p-1 hover:bg-black/10 rounded transition-colors cursor-pointer"
              title="删除"
              style={{ color: 'var(--text-primary, var(--ic-on-surface, #1f1f1f))' }}
            >
              <DeleteOutlined style={{ fontSize: 14 }} />
            </button>
            <button
              onClick={handleDuplicate}
              className="p-1 hover:bg-black/10 rounded transition-colors cursor-pointer"
              title="复制"
              style={{ color: 'var(--text-primary, var(--ic-on-surface, #1f1f1f))' }}
            >
              <CopyOutlined style={{ fontSize: 14 }} />
            </button>
          </div>
        </div>

        <div className="p-4 nodrag">
          <div
            className="rounded-lg px-3 py-2 text-[11px] leading-5"
            style={{
              backgroundColor: 'var(--bg-secondary, var(--ic-surface-container-low, #f4efe9))',
              color: 'var(--text-secondary, var(--ic-on-surface-variant, #6b6b6b))',
            }}
          >
            选中后用底部生成栏发送
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageConfigNode;
