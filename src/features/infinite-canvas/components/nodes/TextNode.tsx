import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { Input, message } from 'antd';
import { CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import { useShallow } from 'zustand/react/shallow';
import { useCanvasStore } from '../../stores/canvasStore';
import PlotMentionText from '@/components/PlotMentionText';
import { mentionizePlot, seedNodeId, type PlotAsset } from '@/lib/plotMentions';
import type { CustomNode } from '../../types';

const { TextArea } = Input;
const DEFAULT_TEXT_LABEL = '文本';

const TextNode: React.FC<NodeProps<CustomNode['data']>> = ({ id, data, selected }) => {
  const { updateNode, duplicateNode, removeNode, selectNode, nodes } = useCanvasStore(
    useShallow((state) => ({
      updateNode: state.updateNode,
      duplicateNode: state.duplicateNode,
      removeNode: state.removeNode,
      selectNode: state.selectNode,
      nodes: state.nodes,
    }))
  );
  const { setCenter } = useReactFlow();
  const [localContent, setLocalContent] = useState(data.content || '');
  const isActNode = id.startsWith('act_');
  const [editingPlot, setEditingPlot] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label || DEFAULT_TEXT_LABEL);

  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditLabel(data.label || DEFAULT_TEXT_LABEL);
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

  const handleLabelKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLabelBlur();
    } else if (e.key === 'Escape') {
      setIsEditingLabel(false);
      setEditLabel(data.label || DEFAULT_TEXT_LABEL);
    }
  }, [handleLabelBlur, data.label]);

  const plotAssets = useMemo<PlotAsset[]>(
    () =>
      nodes.flatMap((node) => {
        const assetId = Number(node.data.sourceAssetId)
        const name = String(node.data.label || '')
        const category = node.data.sourceType
        if (!assetId || !name) return []
        if (category !== 'character' && category !== 'scene' && category !== 'object') return []
        return [{ id: assetId, name, category, image: String(node.data.url || '') }]
      }),
    [nodes]
  )

  useEffect(() => {
    if (localContent === (data.content || '')) return;
    const timeoutId = setTimeout(() => {
      updateNode(id, { content: localContent });
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [localContent, data.content, id, updateNode]);

  const focusAsset = useCallback((asset: PlotAsset) => {
    const nodeId =
      nodes.find(
        (node) =>
          node.id === seedNodeId(asset) ||
          (String(node.data.sourceAssetId) === String(asset.id) && node.data.sourceType === asset.category)
      )?.id
    if (!nodeId) {
      message.warning(`画布上还没有「${asset.name}」资产节点`)
      return
    }
    const node = nodes.find((item) => item.id === nodeId)
    selectNode(nodeId)
    if (node) {
      setCenter(node.position.x + 120, node.position.y + 90, { zoom: 1.05, duration: 380 })
    }
  }, [nodes, selectNode, setCenter])

  const finishPlotEdit = useCallback(() => {
    if (!isActNode) return
    const next = mentionizePlot(localContent, plotAssets)
    if (next !== localContent) setLocalContent(next)
    setEditingPlot(false)
  }, [isActNode, localContent, plotAssets])

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
    <div className="relative group">
      <div
        className={`rounded-lg shadow-lg border-2 ${
          selected ? 'border-[hsl(var(--primary))] shadow-[0_0_0_1px_rgba(172,46,0,0.24)]' : 'border-[var(--border-color)]'
        } min-w-[280px] transition-colors relative`}
        style={{ 
          backgroundColor: 'var(--bg-primary, var(--ic-surface-container-lowest, #ffffff))',
          borderColor: selected ? undefined : 'var(--border-color, var(--ic-outline-variant, rgba(26,26,26,0.18)))',
        }}
      >
        <Handle type="target" position={Position.Left} className="!bg-[hsl(var(--primary))]" />
        <Handle type="source" position={Position.Right} className="!bg-[hsl(var(--primary))]" />

        <div
          className={`px-4 py-2 font-semibold rounded-t-md flex items-center justify-between ${
            selected
              ? 'text-white'
              : ''
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
              {isActNode ? (
                <PlotMentionText text={`📝 ${data.label || '本幕'}`} assets={plotAssets} onMentionClick={focusAsset} />
              ) : (
                <>📝 {data.label || DEFAULT_TEXT_LABEL}</>
              )}
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

        <div
          className="p-4 space-y-2 rounded-b-lg"
          style={{ backgroundColor: "var(--bg-primary, var(--ic-surface-container-lowest, hsl(var(--surface-container-lowest))))" }}
        >
          {isActNode && !editingPlot ? (
            <div
              className="nodrag nowheel min-h-[132px] max-h-[240px] overflow-y-auto whitespace-pre-wrap rounded-md px-2 py-1 text-sm leading-6"
              style={{ color: 'var(--text-primary, var(--ic-on-surface, #1f1f1f))' }}
              onClick={() => setEditingPlot(true)}
              title="点击编辑，点 @资产 可跳转到对应节点"
            >
              <PlotMentionText text={localContent} assets={plotAssets} onMentionClick={focusAsset} />
            </div>
          ) : (
            <TextArea
              value={localContent}
              onChange={(e) => setLocalContent(e.target.value)}
              onBlur={finishPlotEdit}
              placeholder="输入文本、旁白或便签…"
              rows={6}
              autoFocus={isActNode && editingPlot}
              className="nodrag nowheel"
              style={{ resize: 'none', maxHeight: 240, overflowY: 'auto' }}
            />
          )}

          <div className="text-xs" style={{ color: 'var(--text-secondary, var(--ic-on-surface-variant, #6b6b6b))' }}>
            便签 · {localContent.length} 字
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextNode;
