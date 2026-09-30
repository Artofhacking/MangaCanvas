import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Position, NodeProps } from 'reactflow';
import { message } from 'antd';
import { Copy, Download, Eye, FolderPlus, Trash2, Video, Volume2, VolumeX } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useCanvasStore } from '../../stores/canvasStore';
import { remapVideoModel } from '../../config/models';
import { isKF2VModel } from '@/api/aigc';
import type { CustomNode } from '../../types';
import { mediaUrl } from '@/lib/mediaUrl';
import PreviewModal from '../PreviewModal';
import SaveToMaterialsModal from '../SaveToMaterialsModal';
import { PlusHandle } from './PlusHandle';
import { bindNodeGenerationCancel, readNodeProgress } from '../../utils/generationJobs';
import {
  MediaEmptyGlyph,
  MediaPreviewCard,
  MediaStageLoading,
  VIDEO_PREVIEW_WIDTH,
  cssAspectRatio,
} from './MediaPreviewCard';
import { nodeAspectRatio } from '../../utils/aspectRatio';
import { useMediaCardFrame } from '../../hooks/useMediaCardFrame';
import { useEnsureVideoPoster } from '../../hooks/useEnsureVideoPoster';
import { readVideoStack } from '../../utils/videoStack';
import { VideoResultStage } from './VideoStackPreview';

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label || '视频节点');
  const [showPreview, setShowPreview] = useState(false);
  const [muted, setMuted] = useState(true);
  const [showSaveToMaterialsModal, setShowSaveToMaterialsModal] = useState(false);
  const frame = useMediaCardFrame(id, data);
  useEnsureVideoPoster(id, data);
  const stack = readVideoStack(data);
  const frontUrl = stack.urls[stack.activeIndex] || '';
  const hasMedia = Boolean(frontUrl);

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

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!frontUrl) return;
    const link = document.createElement('a');
    link.href = mediaUrl(frontUrl);
    link.download = `video_${Date.now()}.mp4`;
    link.click();
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMuted((prev) => {
      const next = !prev;
      if (videoRef.current) {
        videoRef.current.muted = next;
        if (!next) videoRef.current.play().catch(() => {});
      }
      return next;
    });
  };

  const handleSaveToMaterials = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!frontUrl) {
      message.info('当前节点还没有视频');
      return;
    }
    setShowSaveToMaterialsModal(true);
  }, [frontUrl]);

  return (
    <>
      <MediaPreviewCard
        selected={selected}
        generating={Boolean(data.loading)}
        label={data.label || '视频节点'}
        icon={<Video />}
        width={VIDEO_PREVIEW_WIDTH}
        resolution={hasMedia ? frame.resolution : undefined}
        aspectRatio={cssAspectRatio(frame.aspect, '16 / 9')}
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
          {
            key: 'preview',
            label: '预览',
            icon: <Eye className="h-4 w-4" />,
            onClick: (event) => {
              event.stopPropagation();
              if (videoRef.current) videoRef.current.pause();
              setShowPreview(true);
            },
            hidden: !hasMedia,
          },
          {
            key: 'mute',
            label: muted ? '打开声音' : '静音',
            icon: muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />,
            onClick: handleToggleMute,
            hidden: !hasMedia,
          },
          {
            key: 'save',
            label: '保存到素材库',
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
            kind="video"
            progress={readNodeProgress(data)}
            label={typeof data.statusLabel === 'string' ? data.statusLabel : undefined}
            onCancel={bindNodeGenerationCancel(id, updateNode)}
          />
        ) : hasMedia ? (
          <VideoResultStage
            nodeId={id}
            data={data}
            selected={selected}
            muted={muted}
            suspended={showPreview}
            videoRef={videoRef}
            onOpenPreview={() => {
              videoRef.current?.pause();
              setShowPreview(true);
            }}
            onToggleMute={handleToggleMute}
          />
        ) : (
          <MediaEmptyGlyph kind="video" />
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
        type="video"
        url={frontUrl}
        title={data.label || '视频预览'}
        nodeId={id}
        initialCategory={typeof data.sourceType === 'string' ? data.sourceType : undefined}
        params={{
          prompt: typeof data.prompt === 'string' ? data.prompt : undefined,
          model: typeof data.model === 'string' ? data.model : undefined,
          ratio: nodeAspectRatio(data),
          resolution: typeof data.resolution === 'string' ? data.resolution : undefined,
          duration: typeof data.duration === 'number' ? data.duration : undefined,
        }}
      />

      <SaveToMaterialsModal
        open={showSaveToMaterialsModal}
        onClose={() => setShowSaveToMaterialsModal(false)}
        imageUrl={mediaUrl(frontUrl) || undefined}
        mediaType="video"
        initialName={data.label || '视频素材'}
        initialCategory={typeof data.sourceType === 'string' ? data.sourceType : undefined}
        nodeId={id}
        prompt={typeof data.prompt === 'string' ? data.prompt : undefined}
      />
    </>
  );
};

export default VideoConfigNode;
