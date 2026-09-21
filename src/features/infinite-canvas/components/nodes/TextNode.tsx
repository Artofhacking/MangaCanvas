import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Position, NodeProps, useReactFlow } from 'reactflow';
import { Input, message } from 'antd';
import { Copy, FileText, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useCanvasStore } from '../../stores/canvasStore';
import PlotMentionText from '@/components/PlotMentionText';
import { mentionizePlot, seedNodeId, type PlotAsset } from '@/lib/plotMentions';
import type { CustomNode } from '../../types';
import { PlusHandle } from './PlusHandle';
import { MediaPreviewCard, TEXT_NOTE_WIDTH } from './MediaPreviewCard';

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
  const displayLabel = data.label || (isActNode ? '本幕' : DEFAULT_TEXT_LABEL);

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
    <div className="text-note-node relative">
      <MediaPreviewCard
        className="text-note-card"
        selected={selected}
        label={displayLabel}
        labelContent={
          isActNode ? (
            <PlotMentionText text={displayLabel} assets={plotAssets} onMentionClick={focusAsset} />
          ) : undefined
        }
        icon={<FileText />}
        width={TEXT_NOTE_WIDTH}
        layout="flow"
        isEditingLabel={isEditingLabel}
        editLabel={editLabel}
        onLabelDoubleClick={handleLabelDoubleClick}
        onLabelChange={handleLabelChange}
        onLabelBlur={handleLabelBlur}
        onLabelKeyDown={handleLabelKeyDown}
        handles={
          <>
            <PlusHandle type="target" position={Position.Left} id="left" isConnectable />
            <PlusHandle type="source" position={Position.Right} id="right" isConnectable />
          </>
        }
        actions={[
          { key: 'duplicate', label: '复制', icon: <Copy className="h-4 w-4" />, onClick: handleDuplicate },
          { key: 'delete', label: '删除', icon: <Trash2 className="h-4 w-4" />, onClick: handleDelete, danger: true },
        ]}
      >
        <div className="flex min-h-[200px] flex-col">
          <div className="min-h-[148px] flex-1 px-3.5 pt-3">
            {isActNode && !editingPlot ? (
              <div
                className="nodrag nowheel min-h-[148px] max-h-[240px] overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-[hsl(var(--on-surface))]"
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
                className="nodrag nopan nowheel !min-h-[148px] !max-h-[240px] text-sm leading-6"
                style={{ resize: 'none', overflowY: 'auto' }}
              />
            )}
          </div>
          <div className="px-3.5 pb-2.5 pt-1 text-[11px] tabular-nums text-[hsl(var(--secondary))]">
            {localContent.length} 字
          </div>
        </div>
      </MediaPreviewCard>
    </div>
  );
};

export default TextNode;
