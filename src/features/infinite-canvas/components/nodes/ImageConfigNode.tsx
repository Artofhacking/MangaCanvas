import React, { useState, useCallback } from 'react';
import { Position, NodeProps } from 'reactflow';
import { message } from 'antd';
import { Copy, Download, FolderPlus, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useCanvasStore } from '../../stores/canvasStore';
import type { CustomNode } from '../../types';
import { mediaUrl } from '@/lib/mediaUrl';
import PreviewModal from '../PreviewModal';
import SaveToMaterialsModal from '../SaveToMaterialsModal';
import { PlusHandle } from './PlusHandle';
import { bindNodeGenerationCancel, readNodeProgress } from '../../utils/generationJobs';
import {
  IMAGE_EMPTY_ASPECT,
  IMAGE_PREVIEW_WIDTH,
  MediaEmptyGlyph,
  MediaPreviewCard,
  MediaStageLoading,
  cssAspectRatio,
} from './MediaPreviewCard';
import { nodeAspectRatio } from '../../utils/aspectRatio';

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
  const [showPreview, setShowPreview] = useState(false);
  const [showSaveToMaterialsModal, setShowSaveToMaterialsModal] = useState(false);
  const hasMedia = Boolean(data.url);

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

  const handleDownload = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data.url) return;
    const link = document.createElement('a');
    link.href = mediaUrl(data.url);
    link.download = `image_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('下载成功');
  }, [data.url]);

  const handleSaveToMaterials = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data.url) {
      message.info('当前节点还没有图片');
      return;
    }
    setShowSaveToMaterialsModal(true);
  }, [data.url]);

  return (
    <>
      <MediaPreviewCard
        selected={selected}
        filled={hasMedia && !data.loading}
        generating={Boolean(data.loading)}
        label={data.label || '画面节点'}
        icon={<ImageIcon />}
        width={IMAGE_PREVIEW_WIDTH}
        aspectRatio={
          hasMedia
            ? cssAspectRatio(nodeAspectRatio(data), IMAGE_EMPTY_ASPECT)
            : IMAGE_EMPTY_ASPECT
        }
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
          {
            key: 'save',
            label: '保存到我的素材',
            icon: <FolderPlus className="h-4 w-4" />,
            onClick: handleSaveToMaterials,
            hidden: !hasMedia,
          },
          { key: 'download', label: '下载', icon: <Download className="h-4 w-4" />, onClick: handleDownload, hidden: !hasMedia },
          { key: 'duplicate', label: '复制', icon: <Copy className="h-4 w-4" />, onClick: handleDuplicate },
          { key: 'delete', label: '删除', icon: <Trash2 className="h-4 w-4" />, onClick: handleDelete, danger: true },
        ]}
      >
        {data.loading ? (
          <MediaStageLoading
            kind="image"
            progress={readNodeProgress(data)}
            onCancel={bindNodeGenerationCancel(id, updateNode)}
          />
        ) : data.url ? (
          <img
            src={mediaUrl(data.url)}
            alt={data.label}
            className="h-full w-full cursor-pointer object-cover transition-opacity hover:opacity-90"
            onClick={() => setShowPreview(true)}
          />
        ) : (
          <MediaEmptyGlyph kind="image" />
        )}
        {data.error ? (
          <div className="absolute inset-x-0 bottom-0 bg-[#b42318]/80 px-3 py-1.5 text-[11px] text-white">
            {data.error}
          </div>
        ) : null}
      </MediaPreviewCard>

      <PreviewModal
        visible={showPreview}
        onClose={() => setShowPreview(false)}
        type="image"
        url={mediaUrl(data.url)}
        title={data.label || '图片预览'}
        nodeId={id}
        initialCategory={typeof data.sourceType === 'string' ? data.sourceType : undefined}
        params={{
          prompt: data.prompt,
          model: data.model,
          ratio: nodeAspectRatio(data),
          size: data.size,
        }}
      />

      <SaveToMaterialsModal
        open={showSaveToMaterialsModal}
        onClose={() => setShowSaveToMaterialsModal(false)}
        imageUrl={mediaUrl(data.url) || undefined}
        initialName={data.label || '图片素材'}
        initialCategory={typeof data.sourceType === 'string' ? data.sourceType : undefined}
        nodeId={id}
        prompt={typeof data.prompt === 'string' ? data.prompt : undefined}
      />
    </>
  );
};

export default ImageConfigNode;
