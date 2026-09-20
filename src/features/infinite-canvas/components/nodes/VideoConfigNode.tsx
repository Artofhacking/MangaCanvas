import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Position, NodeProps } from 'reactflow';
import { message } from 'antd';
import { Copy, Download, Trash2, Video, Volume2, VolumeX } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useCanvasStore } from '../../stores/canvasStore';
import { remapVideoModel } from '../../config/models';
import { isKF2VModel } from '@/api/aigc';
import type { CustomNode } from '../../types';
import { mediaUrl } from '@/lib/mediaUrl';
import PreviewModal from '../PreviewModal';
import { PlusHandle } from './PlusHandle';
import { bindNodeGenerationCancel, readNodeProgress } from '../../utils/generationJobs';
import {
  MediaEmptyGlyph,
  MediaPreviewCard,
  MediaStageLoading,
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label || '视频节点');
  const [showPreview, setShowPreview] = useState(false);
  const [muted, setMuted] = useState(true);
  const hasMedia = Boolean(data.url);

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
    if (!data.url) return;
    const link = document.createElement('a');
    link.href = mediaUrl(data.url);
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

  return (
    <>
      <MediaPreviewCard
        selected={selected}
        filled={hasMedia && !data.loading}
        generating={Boolean(data.loading)}
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
          {
            key: 'mute',
            label: muted ? '打开声音' : '静音',
            icon: muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />,
            onClick: handleToggleMute,
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
            onCancel={bindNodeGenerationCancel(id, updateNode)}
          />
        ) : data.url ? (
          <div className="relative h-full w-full">
            <video
              ref={videoRef}
              src={mediaUrl(data.url)}
              autoPlay
              loop
              muted={muted}
              playsInline
              className="h-full w-full bg-black object-cover"
              poster={mediaUrl(data.thumbnail)}
              onCanPlay={() => {
                videoRef.current?.play().catch(() => {});
              }}
            />
            <div
              className="absolute inset-0 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (videoRef.current) {
                  videoRef.current.pause();
                }
                setShowPreview(true);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            />
            <button
              type="button"
              onClick={handleToggleMute}
              className="nodrag nopan absolute bottom-2.5 right-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white/90 backdrop-blur-sm"
              title={muted ? '打开声音' : '静音'}
            >
              {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
          </div>
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
        url={data.url || ''}
        title={data.label || '视频预览'}
        params={{
          prompt: typeof data.prompt === 'string' ? data.prompt : undefined,
          model: typeof data.model === 'string' ? data.model : undefined,
          resolution: typeof data.resolution === 'string' ? data.resolution : undefined,
          duration: typeof data.duration === 'number' ? data.duration : undefined,
        }}
      />
    </>
  );
};

export default VideoConfigNode;
