import React, { useCallback, useMemo, useState } from 'react';
import { Position, NodeProps, useReactFlow } from 'reactflow';
import { message } from 'antd';
import { AlignJustify, Copy, FileText, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useCanvasStore } from '../../stores/canvasStore';
import PlotMentionText from '@/components/PlotMentionText';
import { seedNodeId, type PlotAsset } from '@/lib/plotMentions';
import type { CustomNode } from '../../types';
import { PlusHandle } from './PlusHandle';
import { MediaPreviewCard, TEXT_NOTE_WIDTH } from './MediaPreviewCard';
import { pointerTravelExceeds } from '../../utils/canvasInteraction';
import { requestTextEditFocus } from '../../utils/textEditFocus';

const DEFAULT_TEXT_LABEL = '文本';

function TextNoteEmptyState({ onWrite }: { onWrite: () => void }) {
  const pointerOrigin = React.useRef<{ x: number; y: number } | null>(null)
  return (
    <div
      className="flex min-h-[256px] flex-col px-7 pb-8 pt-9"
      onPointerDown={(event) => {
        pointerOrigin.current = { x: event.clientX, y: event.clientY }
      }}
      onClick={(event) => {
        if (pointerTravelExceeds(pointerOrigin.current, event)) return
        onWrite()
      }}
    >
      <div className="mb-8 flex justify-center" aria-hidden>
        <AlignJustify className="h-7 w-7 text-[hsl(var(--on-surface-variant))]/45" strokeWidth={1.65} />
      </div>
      <p className="mb-3 text-[12px] leading-none text-[hsl(var(--secondary))]">尝试:</p>
      <button
        type="button"
        className="nodrag nopan nowheel flex w-full items-center gap-2.5 rounded-lg py-1 text-left text-[13px] text-[hsl(var(--on-surface))] transition-colors hover:bg-[hsl(var(--surface-container-low))]"
        onClick={(event) => {
          event.stopPropagation()
          onWrite()
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-[hsl(var(--outline-variant))]/80 text-[hsl(var(--on-surface-variant))]">
          <FileText className="h-2.5 w-2.5" />
        </span>
        自己编写内容
      </button>
    </div>
  )
}

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
  const isActNode = id.startsWith('act_');
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label || DEFAULT_TEXT_LABEL);
  const displayLabel = data.label || (isActNode ? '本幕' : DEFAULT_TEXT_LABEL);
  const content = typeof data.content === 'string' ? data.content : '';
  const isEmpty = content.trim().length === 0;

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

  const pointerOrigin = React.useRef<{ x: number; y: number } | null>(null)

  const enterWrite = useCallback(() => {
    selectNode(id)
    requestTextEditFocus(id)
  }, [id, selectNode])

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
        {isEmpty ? (
          <TextNoteEmptyState onWrite={enterWrite} />
        ) : (
          <button
            type="button"
            className="nowheel flex min-h-[200px] w-full flex-col px-3.5 py-3 text-left"
            onPointerDown={(event) => {
              pointerOrigin.current = { x: event.clientX, y: event.clientY }
            }}
            onClick={(event) => {
              if (pointerTravelExceeds(pointerOrigin.current, event)) return
              enterWrite()
            }}
            title="在底部编辑旁白或便签"
          >
            <div className="max-h-[240px] overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-[hsl(var(--on-surface))]">
              {isActNode ? (
                <PlotMentionText text={content} assets={plotAssets} onMentionClick={focusAsset} />
              ) : (
                content
              )}
            </div>
          </button>
        )}
      </MediaPreviewCard>
    </div>
  );
};

export default TextNode;
