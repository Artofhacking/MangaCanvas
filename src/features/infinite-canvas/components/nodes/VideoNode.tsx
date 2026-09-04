import React, { useRef, useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { message, Input } from 'antd';
import { DownloadOutlined, CopyOutlined, DeleteOutlined, VideoCameraOutlined, PictureOutlined } from '@ant-design/icons';
import { useCanvasStore } from '../../stores/canvasStore';
import PreviewModal from '../PreviewModal';
import type { CustomNode } from '../../types';

// 自定义视频 Loading 动画组件
const VideoLoadingAnimation: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-48 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg overflow-hidden relative">
    {/* Shimmer 效果 */}
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
    
    {/* 图标和圆点 */}
    <div className="relative z-10 flex flex-col items-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center animate-pulse shadow-lg">
        <VideoCameraOutlined className="text-white text-xl" />
      </div>
      <div className="flex gap-1.5">
        <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
);

const VideoNode: React.FC<NodeProps<CustomNode['data']>> = ({ id, data, selected }) => {
  const { nodes, edges, updateNode, duplicateNode, removeNode, addNode, addEdgeManually } = useCanvasStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label || '');
  const [extracting, setExtracting] = useState(false);

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

  const handleLabelKeyDown = useCallback((e: React.KeyboardEvent) => {
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

  return (
    <div className="relative">
      {/* Main node content */}
      <div
        className={`rounded-lg shadow-lg border-2 ${
          selected ? 'border-[hsl(var(--primary))] shadow-[0_0_0_1px_rgba(172,46,0,0.24)]' : 'border-[var(--border-color)]'
        } min-w-[320px] transition-colors relative`}
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        {/* Handles */}
        <Handle type="target" position={Position.Left} className="!bg-[hsl(var(--primary))]" />
        <Handle type="source" position={Position.Right} className="!bg-[hsl(var(--primary))]" />

        {/* Header */}
        <div
          className={`px-4 py-2 font-semibold rounded-t-md flex items-center justify-between ${
            selected
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white'
              : ''
          }`}
          style={selected ? { background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, #d73b00 100%)' } : { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
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
              🎥 {data.label || '视频节点'}
            </span>
          )}
          <div className="flex items-center gap-1">
            {data.url && (
              <button
                onClick={handleExtractLastFrame}
                className="p-1 hover:bg-black/10 rounded transition-colors cursor-pointer"
                title="提取尾帧"
                disabled={extracting}
              >
                <PictureOutlined style={{ fontSize: 14 }} spin={extracting} />
              </button>
            )}
            {data.url && (
              <button
                onClick={handleDownload}
                className="p-1 hover:bg-black/10 rounded transition-colors cursor-pointer"
                title="下载"
              >
                <DownloadOutlined style={{ fontSize: 14 }} />
              </button>
            )}
            <button
              onClick={handleDelete}
              className="p-1 hover:bg-black/10 rounded transition-colors cursor-pointer"
              title="删除"
            >
              <DeleteOutlined style={{ fontSize: 14 }} />
            </button>
            <button
              onClick={handleDuplicate}
              className="p-1 hover:bg-black/10 rounded transition-colors cursor-pointer"
              title="复制"
            >
              <CopyOutlined style={{ fontSize: 14 }} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {data.loading ? (
            <VideoLoadingAnimation />
          ) : data.error ? (
            <div className="flex items-center justify-center h-48 bg-red-50 dark:bg-red-900/20 rounded text-red-500">
              ❌ {data.error}
            </div>
          ) : data.url ? (
            <div className="relative group">
              <video
                ref={videoRef}
                src={data.url}
                autoPlay
                loop
                muted
                playsInline
                className="w-full max-h-64 rounded object-contain bg-black"
                poster={data.thumbnail}
                onCanPlay={() => {
                  // 确保视频能够自动播放
                  videoRef.current?.play().catch(() => {});
                }}
              />
              {/* 透明覆盖层用于捕获点击打开预览，避免与视频控件冲突 */}
              <div
                className="absolute inset-0 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  // 点击预览时停止播放
                  if (videoRef.current) {
                    videoRef.current.pause();
                  }
                  setShowPreview(true);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                style={{ pointerEvents: 'auto' }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 rounded" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
              等待视频生成...
            </div>
          )}
        </div>
      </div>

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
          resolution: data?.resolution as string | undefined,
          duration: data?.duration as number | undefined,
        }}
      />
    </div>
  );
};

export default VideoNode;
