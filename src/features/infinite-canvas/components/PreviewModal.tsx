import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { message, Modal } from 'antd';
import { CloseOutlined, DownloadOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import { projectAssetsApi } from '@/api/projectAssetsApi';
import type { ProjectAssetDTO } from '@/api/types';
import {
  FAVORITES_CHANGED_EVENT,
  isSameFavoriteTarget,
  notifyFavoritesChanged,
  stripCollectMetadata,
} from '@/lib/favorites';
import { mediaUrl } from '@/lib/mediaUrl';
import { resolveProjectId } from '@/lib/session';
import SaveToMaterialsModal from './SaveToMaterialsModal';

interface PreviewParams {
  prompt?: string;
  model?: string;
  ratio?: string;
  size?: string;
  resolution?: string;
  duration?: number;
}

interface PreviewModalProps {
  visible: boolean;
  onClose: () => void;
  type: 'image' | 'video';
  url: string;
  title?: string;
  onDownload?: () => void;
  params?: PreviewParams;
  nodeId?: string;
  initialCategory?: string;
}

const defaultCollectName = (
  type: 'image' | 'video',
  title?: string,
  prompt?: string,
) => {
  const snippet = prompt?.trim();
  if (snippet) {
    return snippet.length > 32 ? `${snippet.slice(0, 32)}…` : snippet;
  }
  if (title?.trim() && title !== '预览') {
    return title.trim();
  }
  return type === 'video' ? '视频素材' : '图片素材';
};

const resolveNumericProjectId = (routeProjectId?: string, routeId?: string) => {
  const parsed = Number(routeProjectId || routeId);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return resolveProjectId();
};

const PreviewModal: React.FC<PreviewModalProps> = ({
  visible,
  onClose,
  type,
  url,
  title = '预览',
  onDownload,
  params,
  nodeId,
  initialCategory,
}) => {
  const { projectId: routeProjectId, id: routeId } = useParams();
  const numericProjectId = resolveNumericProjectId(routeProjectId, routeId);
  const [collectOpen, setCollectOpen] = useState(false);
  const [favorite, setFavorite] = useState<ProjectAssetDTO | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const favoriteRequest = useRef(0);
  const collectName = useMemo(
    () => defaultCollectName(type, title, params?.prompt),
    [params?.prompt, title, type],
  );

  const refreshFavorite = useCallback(async () => {
    const requestId = ++favoriteRequest.current;
    if (!url || !numericProjectId) {
      setFavorite(null);
      return;
    }
    try {
      const data = await projectAssetsApi.list(numericProjectId, {
        page: 1,
        size: 100,
        collected: true,
        ...(nodeId ? { nodeId } : {}),
      });
      if (requestId !== favoriteRequest.current) return;
      const match = (data.list || []).find((item) => isSameFavoriteTarget(item, { url, nodeId })) || null;
      setFavorite(match);
    } catch {
      if (requestId !== favoriteRequest.current) return;
      setFavorite(null);
    }
  }, [nodeId, numericProjectId, url]);

  useEffect(() => {
    if (!visible) {
      setCollectOpen(false);
      return;
    }
    void refreshFavorite();
    const refresh = () => {
      void refreshFavorite();
    };
    window.addEventListener(FAVORITES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(FAVORITES_CHANGED_EVENT, refresh);
  }, [refreshFavorite, visible]);

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type}_${Date.now()}.${type === 'image' ? 'png' : 'mp4'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleCollect = async () => {
    if (!url || favoriteBusy) return;
    if (favorite && numericProjectId) {
      favoriteRequest.current += 1;
      setFavoriteBusy(true);
      try {
        await projectAssetsApi.update(numericProjectId, favorite.id, {
          metadata: stripCollectMetadata(favorite.metadata),
        });
        setFavorite(null);
        notifyFavoritesChanged();
        message.success('已取消收藏');
      } catch (error) {
        message.error(error instanceof Error ? error.message : '取消收藏失败');
      } finally {
        setFavoriteBusy(false);
      }
      return;
    }
    setCollectOpen(true);
  };

  const hasParams = params && (params.prompt || params.model);

  // 阻止右键事件
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width="90vw"
      style={{ maxWidth: 1400, top: 20 }}
      closeIcon={null}
      styles={{
        body: { padding: 0 },
        content: { backgroundColor: 'rgba(0,0,0,0.95)', borderRadius: 12 },
      }}
      destroyOnClose
    >
      <div className="relative" onContextMenu={handleContextMenu}>
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10 bg-gradient-to-b from-black/60 to-transparent">
          <span className="text-white font-medium">{title}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCollect()}
              disabled={!url || favoriteBusy}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              title={favorite ? '取消收藏' : '收藏'}
              aria-label={favorite ? '取消收藏' : '收藏'}
              aria-pressed={Boolean(favorite)}
            >
              {favorite ? <StarFilled className="text-white" /> : <StarOutlined className="text-white" />}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors cursor-pointer"
              title="下载"
            >
              <DownloadOutlined className="text-white" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors cursor-pointer"
              title="关闭"
            >
              <CloseOutlined className="text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex min-h-[60vh] max-h-[85vh] p-8 pt-16">
          {/* 媒体预览 */}
          <div className={`flex items-center justify-center ${hasParams ? 'flex-1' : 'w-full'}`}>
            {type === 'image' ? (
              <img
                src={mediaUrl(url)}
                alt={title}
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
              />
            ) : (
              <video
                src={mediaUrl(url)}
                controls
                autoPlay
                className="max-w-full max-h-[75vh] rounded-lg"
              />
            )}
          </div>
          
          {/* 参数信息 */}
          {hasParams && (
            <div className="w-64 ml-6 flex-shrink-0 space-y-4 text-sm overflow-y-auto" style={{ maxHeight: '75vh' }}>
              {params.model && (
                <div>
                  <span className="text-white/60 text-xs">模型</span>
                  <p className="text-white mt-1">{params.model}</p>
                </div>
              )}
              {params.ratio && (
                <div>
                  <span className="text-white/60 text-xs">画面比例</span>
                  <p className="text-white mt-1">{params.ratio}</p>
                </div>
              )}
              {params.resolution && (
                <div>
                  <span className="text-white/60 text-xs">分辨率</span>
                  <p className="text-white mt-1">{params.resolution}</p>
                </div>
              )}
              {params.duration && (
                <div>
                  <span className="text-white/60 text-xs">时长</span>
                  <p className="text-white mt-1">{params.duration}秒</p>
                </div>
              )}
              {params.prompt && (
                <div>
                  <span className="text-white/60 text-xs">提示词</span>
                  <p className="text-white/90 mt-1 leading-relaxed break-all">{params.prompt}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
    <SaveToMaterialsModal
      open={collectOpen}
      onClose={() => setCollectOpen(false)}
      imageUrl={url || undefined}
      mediaType={type}
      initialName={collectName}
      initialCategory={initialCategory}
      nodeId={nodeId}
      confirmLabel="收藏到资产库"
      asFavorite
      prompt={params?.prompt}
      onSaved={() => {
        void refreshFavorite();
      }}
    />
    </>
  );
};

export default PreviewModal;
