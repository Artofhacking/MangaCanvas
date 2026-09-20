import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Position, NodeProps } from 'reactflow';
import { Upload, Spin, message } from 'antd';
import { DeleteOutlined, DownloadOutlined, CopyOutlined, PictureOutlined, EyeOutlined, FolderAddOutlined, AppstoreAddOutlined } from '@ant-design/icons';
import { Copy, Download, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useCanvasStore } from '../../stores/canvasStore';
import PreviewModal from '../PreviewModal';
import SaveToMaterialsModal from '../SaveToMaterialsModal';
import type { CanvasMaterialItem, CustomNode } from '../../types';
import { MATERIAL_DRAG_MIME } from '../MaterialPanel';
import { mediaUrl } from '@/lib/mediaUrl';
import { PlusHandle } from './PlusHandle';
import {
  IMAGE_EMPTY_ASPECT,
  IMAGE_PREVIEW_WIDTH,
  MediaEmptyGlyph,
  MediaPreviewCard,
  MediaStageLoading,
  cssAspectRatio,
} from './MediaPreviewCard';

const ImageNode: React.FC<NodeProps<CustomNode['data']>> = ({ id, data, selected }) => {
  const { updateNode, removeNode, duplicateNode } = useCanvasStore();
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label || '');
  const [isDropActive, setIsDropActive] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showSaveToMaterialsModal, setShowSaveToMaterialsModal] = useState(false);
  const contextMenuRef = React.useRef<HTMLDivElement | null>(null);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

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

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    removeNode(id);
  }, [id, removeNode]);

  const removeCurrentNode = useCallback(() => {
    closeContextMenu();
    removeNode(id);
  }, [closeContextMenu, id, removeNode]);

  const handleDownload = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data?.url) return;

    const link = document.createElement('a');
    link.href = mediaUrl(data.url);
    link.download = `image_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('下载成功');
  }, [data?.url]);

  const downloadImage = useCallback(() => {
    if (!data?.url) return;

    const link = document.createElement('a');
    link.href = mediaUrl(data.url);
    link.download = `image_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('下载成功');
  }, [data?.url]);

  const handleUpload = useCallback(
    (file: File) => {
      setUploading(true);

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        updateNode(id, {
          url: base64,
          base64: base64,
          loading: false,
          label: '上传图片',
        });
        setUploading(false);
        message.success('图片上传成功');
      };
      reader.onerror = () => {
        setUploading(false);
        message.error('图片上传失败');
      };
      reader.readAsDataURL(file);

      return false;
    },
    [id, updateNode]
  );

  const handleDuplicate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateNode(id);
    message.success('节点已复制');
  }, [id, duplicateNode]);

  const duplicateCurrentNode = useCallback(() => {
    duplicateNode(id);
    message.success('节点已复制');
  }, [duplicateNode, id]);

  const applyMaterialToNode = useCallback((item: CanvasMaterialItem) => {
    if (!item.cover) return;
    updateNode(id, {
      url: item.cover,
      thumbnail: item.cover,
      label: item.title,
      loading: false,
      sourceType: item.category,
      sourceAssetId: item.id,
      sourceLibrary: item.library,
      updatedAt: Date.now(),
    });
    message.success(`已使用素材“${item.title}”`);
  }, [id, updateNode]);

  const applyImageToNode = useCallback((payload: { url: string; base64?: string; label?: string }) => {
    updateNode(id, {
      url: payload.url,
      base64: payload.base64,
      label: payload.label || data.label || '图片节点',
      loading: false,
      updatedAt: Date.now(),
    });
  }, [data.label, id, updateNode]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes(MATERIAL_DRAG_MIME)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setIsDropActive(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDropActive(false);
    }
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const raw = event.dataTransfer.getData(MATERIAL_DRAG_MIME);
    if (!raw) return;

    event.preventDefault();
    event.stopPropagation();
    setIsDropActive(false);

    try {
      const item = JSON.parse(raw) as CanvasMaterialItem;
      applyMaterialToNode(item);
    } catch {
      message.error('素材读取失败');
    }
  }, [applyMaterialToNode]);

  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const menuWidth = 280;
    const menuHeight = 360;
    const nextX = Math.min(event.clientX, window.innerWidth - menuWidth - 16);
    const nextY = Math.min(event.clientY, window.innerHeight - menuHeight - 16);

    setContextMenu({
      x: Math.max(12, nextX),
      y: Math.max(12, nextY),
    });
  }, []);

  const fetchImageBlob = useCallback(async () => {
    if (!data?.url) return null;
    const response = await fetch(mediaUrl(data.url));
    if (!response.ok) {
      throw new Error('图片读取失败');
    }
    return response.blob();
  }, [data?.url]);

  const handleCopyImage = useCallback(async () => {
    closeContextMenu();

    if (!data?.url) {
      message.info('当前节点还没有图片');
      return;
    }

    try {
      const imageBlob = await fetchImageBlob();
      if (!imageBlob) return;

      if (window.ClipboardItem && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new window.ClipboardItem({ [imageBlob.type || 'image/png']: imageBlob }),
        ]);
        message.success('图片已复制');
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(data.url);
        message.success('当前环境不支持直接复制图片，已复制图片地址');
        return;
      }

      throw new Error('当前环境不支持复制');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '复制失败');
    }
  }, [closeContextMenu, data?.url, fetchImageBlob]);

  const handlePasteReplace = useCallback(async () => {
    closeContextMenu();

    try {
      if (!navigator.clipboard?.read) {
        throw new Error('当前浏览器不支持读取剪贴板图片');
      }

      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith('image/'));
        if (!imageType) continue;

        const blob = await item.getType(imageType);
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
          const base64 = loadEvent.target?.result as string;
          applyImageToNode({ url: base64, base64, label: '粘贴图片' });
          message.success('已替换为剪贴板图片');
        };
        reader.onerror = () => {
          message.error('图片读取失败');
        };
        reader.readAsDataURL(blob);
        return;
      }

      const text = await navigator.clipboard.readText();
      if (text && /^https?:\/\/.+\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(text.trim())) {
        applyImageToNode({ url: text.trim(), label: '网络图片' });
        message.success('已替换为剪贴板图片链接');
        return;
      }

      message.info('剪贴板里没有可用图片');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '粘贴失败');
    }
  }, [applyImageToNode, closeContextMenu]);

  const handleSaveToMaterials = useCallback(() => {
    closeContextMenu();
    setShowSaveToMaterialsModal(true);
  }, [closeContextMenu]);

  const handleCreateSubject = useCallback(() => {
    closeContextMenu();
    message.info('创建主体功能即将接入');
  }, [closeContextMenu]);

  React.useEffect(() => {
    const clearDropState = () => {
      setIsDropActive(false);
    };

    window.addEventListener('dragend', clearDropState);
    window.addEventListener('drop', clearDropState);

    return () => {
      window.removeEventListener('dragend', clearDropState);
      window.removeEventListener('drop', clearDropState);
    };
  }, []);

  React.useEffect(() => {
    if (!contextMenu) return;

    const handleGlobalClose = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && contextMenuRef.current?.contains(target)) {
        return;
      }
      setContextMenu(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    window.addEventListener('pointerdown', handleGlobalClose);
    window.addEventListener('scroll', handleGlobalClose, true);
    window.addEventListener('resize', handleGlobalClose);
    window.addEventListener('contextmenu', handleGlobalClose);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('pointerdown', handleGlobalClose);
      window.removeEventListener('scroll', handleGlobalClose, true);
      window.removeEventListener('resize', handleGlobalClose);
      window.removeEventListener('contextmenu', handleGlobalClose);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu]);

  return (
    <div 
      className="image-node relative group"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={handleContextMenu}
    >
      <MediaPreviewCard
        selected={selected}
        dropActive={isDropActive}
        filled={Boolean(data?.url) && !data?.loading}
        label={data.label || '图片节点'}
        icon={<ImageIcon />}
        width={IMAGE_PREVIEW_WIDTH}
        aspectRatio={
          data?.url
            ? cssAspectRatio(typeof data.ratio === 'string' ? data.ratio : undefined, IMAGE_EMPTY_ASPECT)
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
          { key: 'download', label: '下载', icon: <Download className="h-4 w-4" />, onClick: handleDownload, hidden: !data?.url },
          { key: 'duplicate', label: '复制', icon: <Copy className="h-4 w-4" />, onClick: handleDuplicate },
          { key: 'delete', label: '删除', icon: <Trash2 className="h-4 w-4" />, onClick: handleDelete, danger: true },
        ]}
      >
        {data?.loading ? (
          <MediaStageLoading kind="image" />
        ) : data?.url ? (
          <img
            src={mediaUrl(data.url)}
            alt={data.label}
            className="h-full w-full cursor-pointer object-cover transition-opacity hover:opacity-90"
            onClick={() => setShowPreview(true)}
          />
        ) : (
          <Upload
            accept="image/*"
            showUploadList={false}
            beforeUpload={handleUpload}
            disabled={uploading}
            className="block h-full w-full"
          >
            <div className="flex h-full w-full cursor-pointer items-center justify-center">
              {uploading ? <Spin /> : <MediaEmptyGlyph kind="image" />}
            </div>
          </Upload>
        )}
        {data?.error ? (
          <div className="absolute inset-x-0 bottom-0 bg-[#b42318]/80 px-3 py-1.5 text-[11px] text-white">
            {data.error}
          </div>
        ) : null}
      </MediaPreviewCard>

      {/* Preview Modal */}
      <PreviewModal
        visible={showPreview}
        onClose={() => setShowPreview(false)}
        type="image"
        url={mediaUrl(data?.url)}
        title={data.label || '图片预览'}
        params={{
          prompt: data?.prompt,
          model: data?.model,
          ratio: data?.ratio,
          size: data?.size,
        }}
      />

      <SaveToMaterialsModal
        open={showSaveToMaterialsModal}
        onClose={() => setShowSaveToMaterialsModal(false)}
        imageUrl={mediaUrl(data?.url) || undefined}
        initialName={data?.label || '图片素材'}
        initialCategory={typeof data?.sourceType === 'string' ? data.sourceType : undefined}
        nodeId={id}
      />

      {contextMenu && typeof document !== 'undefined' && createPortal(
        <div
          ref={contextMenuRef}
          className="fixed z-[1200] w-[280px] overflow-hidden rounded-[28px] border border-black/10 bg-white/96 p-3 text-[#161616] shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="px-2 pb-2 pt-1 text-[15px] font-semibold text-[#1b1b1b]">
            {data.label || '图片节点'}
          </div>

          <div className="space-y-1">
            <button
              onClick={() => {
                closeContextMenu();
                setShowPreview(true);
              }}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] transition-colors hover:bg-black/5"
            >
              <EyeOutlined style={{ fontSize: 17 }} />
              <span>预览图片</span>
            </button>

            <button
              onClick={handleSaveToMaterials}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] transition-colors hover:bg-black/5"
            >
              <FolderAddOutlined style={{ fontSize: 17 }} />
              <span>保存到我的素材</span>
            </button>

            <button
              onClick={handleCreateSubject}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] transition-colors hover:bg-black/5"
            >
              <AppstoreAddOutlined style={{ fontSize: 17 }} />
              <span>创建主体</span>
            </button>
          </div>

          <div className="my-2 h-px bg-black/8" />

          <div className="space-y-1">
            <button
              onClick={() => {
                closeContextMenu();
                duplicateCurrentNode();
              }}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] transition-colors hover:bg-black/5"
            >
              <CopyOutlined style={{ fontSize: 17 }} />
              <span>复制节点</span>
              <span className="ml-auto text-xs text-black/35">Cmd/Ctrl+C</span>
            </button>

            <button
              onClick={handleCopyImage}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] transition-colors hover:bg-black/5"
            >
              <PictureOutlined style={{ fontSize: 17 }} />
              <span>复制图片</span>
            </button>

            <button
              onClick={handlePasteReplace}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] transition-colors hover:bg-black/5"
            >
              <PictureOutlined style={{ fontSize: 17 }} />
              <span>粘贴替换</span>
              <span className="ml-auto text-xs text-black/35">Cmd/Ctrl+V</span>
            </button>

            <button
              onClick={() => {
                closeContextMenu();
                duplicateCurrentNode();
              }}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] transition-colors hover:bg-black/5"
            >
              <AppstoreAddOutlined style={{ fontSize: 17 }} />
              <span>创建副本</span>
            </button>

            <button
              onClick={() => {
                closeContextMenu();
                downloadImage();
              }}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] transition-colors hover:bg-black/5"
            >
              <DownloadOutlined style={{ fontSize: 17 }} />
              <span>下载图片</span>
            </button>

            <button
              onClick={removeCurrentNode}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] text-[#b42318] transition-colors hover:bg-[#b42318]/8"
            >
              <DeleteOutlined style={{ fontSize: 17 }} />
              <span>删除节点</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ImageNode;
