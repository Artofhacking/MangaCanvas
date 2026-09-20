import React, { useRef, useState, useCallback } from 'react';
import { Position, NodeProps } from 'reactflow';
import { message } from 'antd';
import { Copy, Download, Image as ImageIcon, Trash2, Video, Volume2, VolumeX } from 'lucide-react';
import { useCanvasStore } from '../../stores/canvasStore';
import PreviewModal from '../PreviewModal';
import type { CustomNode } from '../../types';
import { mediaUrl } from '@/lib/mediaUrl';
import { PlusHandle } from './PlusHandle';
import {
  MediaEmptyGlyph,
  MediaPreviewCard,
  MediaStageLoading,
  VIDEO_PREVIEW_WIDTH,
  cssAspectRatio,
} from './MediaPreviewCard';
import { nodeAspectRatio } from '../../utils/aspectRatio';

const VideoNode: React.FC<NodeProps<CustomNode['data']>> = ({ id, data, selected }) => {
  const { nodes, edges, updateNode, duplicateNode, removeNode, addNode, addEdgeManually } = useCanvasStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label || '');
  const [extracting, setExtracting] = useState(false);
  const [muted, setMuted] = useState(true);

  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditLabel(data.label || '');
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
      setEditLabel(data.label || '');
    }
  }, [handleLabelBlur, data.label]);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data.url) return;
    const link = document.createElement('a');
    link.href = data.url;
    link.download = `video_${Date.now()}.mp4`;
    link.click();
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateNode(id);
    message.success('节点已复制');
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeNode(id);
  };

  // 将 OSS URL 转换为代理 URL
  const getProxyUrl = (url: string): string => {
    if (url.includes('dashscope-result-sh.oss-cn-shanghai.aliyuncs.com')) {
      return url.replace('https://dashscope-result-sh.oss-cn-shanghai.aliyuncs.com', '/oss-proxy-sh');
    }
    if (url.includes('dashscope-result-wlcb.oss-cn-wulanchabu.aliyuncs.com')) {
      return url.replace('https://dashscope-result-wlcb.oss-cn-wulanchabu.aliyuncs.com', '/oss-proxy-wlcb');
    }
    return url;
  };

  // 提取视频最后一帧
  const handleExtractLastFrame = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data.url || extracting) return;

    setExtracting(true);
    try {
      // 创建临时 video 元素，使用代理 URL
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = getProxyUrl(data.url);
      video.muted = true;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => {
          // 跳转到最后一帧（留小余量避免越界）
          video.currentTime = Math.max(0, video.duration - 0.1);
        };
        video.onseeked = () => resolve();
        video.onerror = () => reject(new Error('视频加载失败'));
      });

      // 用 canvas 截取当前帧
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 初始化失败');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 转换为 base64
      const base64 = canvas.toDataURL('image/png');

      // 获取当前节点位置
      const currentNode = nodes.find((n) => n.id === id);
      if (!currentNode) throw new Error('节点不存在');

      // 计算新节点位置（在右侧）
      const outgoing = edges.filter((e) => e.source === id);
      const xOffset = outgoing.length * 320;

      // 创建图片节点
      const imageNodeId = addNode(
        'image',
        { x: currentNode.position.x + 400 + xOffset, y: currentNode.position.y },
        { 
          label: '尾帧截图', 
          base64,
          url: base64,
        }
      );

      // 连接节点
      addEdgeManually({ source: id, target: imageNodeId });

      message.success('已提取最后一帧');
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '提取失败');
    } finally {
      setExtracting(false);
    }
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
    <div className="relative">
      <MediaPreviewCard
        selected={selected}
        filled={Boolean(data.url) && !data.loading}
        label={data.label || '视频节点'}
        icon={<Video />}
        width={VIDEO_PREVIEW_WIDTH}
        aspectRatio={cssAspectRatio(nodeAspectRatio(data), '16 / 9')}
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
            key: 'mute',
            label: muted ? '打开声音' : '静音',
            icon: muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />,
            onClick: handleToggleMute,
            hidden: !data.url,
          },
          {
            key: 'extract',
            label: extracting ? '提取中…' : '提取尾帧',
            icon: <ImageIcon className="h-4 w-4" />,
            onClick: handleExtractLastFrame,
            hidden: !data.url,
            disabled: extracting,
          },
          { key: 'download', label: '下载', icon: <Download className="h-4 w-4" />, onClick: handleDownload, hidden: !data.url },
          { key: 'duplicate', label: '复制', icon: <Copy className="h-4 w-4" />, onClick: handleDuplicate },
          { key: 'delete', label: '删除', icon: <Trash2 className="h-4 w-4" />, onClick: handleDelete, danger: true },
        ]}
      >
        {data.loading ? (
          <MediaStageLoading kind="video" />
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

      {/* Preview Modal */}
      <PreviewModal
        visible={showPreview}
        onClose={() => setShowPreview(false)}
        type="video"
        url={data?.url || ''}
        title={data.label || '视频预览'}
        params={{
          prompt: data?.prompt as string | undefined,
          model: data?.model as string | undefined,
          ratio: nodeAspectRatio(data || {}),
          resolution: data?.resolution as string | undefined,
          duration: data?.duration as number | undefined,
        }}
      />
    </div>
  );
};

export default VideoNode;
