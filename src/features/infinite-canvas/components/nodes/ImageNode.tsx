import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Position, NodeProps } from 'reactflow';
import { Upload, Spin, message } from 'antd';
import { DeleteOutlined, DownloadOutlined, CopyOutlined, PictureOutlined, EyeOutlined, FolderAddOutlined, AppstoreAddOutlined } from '@ant-design/icons';
import { Copy, Download, Eye, FolderPlus, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useCanvasStore } from '../../stores/canvasStore';
import PreviewModal from '../PreviewModal';
import SaveToMaterialsModal from '../SaveToMaterialsModal';
import type { CanvasMaterialItem, CustomNode } from '../../types';
import { MATERIAL_DRAG_MIME } from '../MaterialPanel';
import { mediaUrl } from '@/lib/mediaUrl';
import { isInlineCanvasMedia } from '@/lib/canvasPayload';
import { uploadCanvasBlob, uploadCanvasMediaUrl } from '@/lib/uploadCanvasMedia';
import { resolveAssetMedia } from '@/lib/assetSeed';
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
import { nextMediaPixelFields, readBlobPixelSize } from '../../utils/mediaFrame';
import { useMediaCardFrame } from '../../hooks/useMediaCardFrame';
import { CanvasImagePreview } from './CanvasImagePreview';

const ImageNode: React.FC<NodeProps<CustomNode['data']>> = ({ id, data, selected }) => {
  const { updateNode, removeNode, duplicateNode } = useCanvasStore();
  const frame = useMediaCardFrame(id, data);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label || '');
  const [isDropActive, setIsDropActive] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showSaveToMaterialsModal, setShowSaveToMaterialsModal] = useState(false);
  const [saveCategory, setSaveCategory] = useState<string | undefined>(undefined);
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
      void Promise.all([uploadCanvasBlob(file), readBlobPixelSize(file)])
        .then(([url, pixels]) => {
          updateNode(id, {
            url,
            base64: undefined,
            thumbnail: undefined,
            loading: false,
            label: '上传图片',
            ...nextMediaPixelFields(pixels),
          });
          message.success('图片上传成功');
        })
        .catch(() => {
          message.error('图片上传失败');
        })
        .finally(() => setUploading(false));

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
    const resolved = resolveAssetMedia({
      name: item.title,
      prompt: item.prompt,
      image: item.cover,
      video: item.video,
      mediaType: item.mediaType,
      hasImage: item.hasImage,
      hasVideo: item.hasVideo,
    });
    if (resolved.kind !== 'image' || !resolved.imageUrl) {
      message.info('这个素材没有可放入图片节点的封面');
      return;
    }
    updateNode(id, {
      url: resolved.imageUrl,
      thumbnail: resolved.imageUrl,
      label: resolved.label || item.title,
      loading: false,
      sourceType: item.category,
      sourceAssetId: item.id,
      sourceLibrary: item.library,
      updatedAt: Date.now(),
      ...nextMediaPixelFields(null),
    });
    message.success(`已使用素材“${item.title}”`);
  }, [id, updateNode]);

  const applyImageToNode = useCallback(async (payload: {
    url: string
    base64?: string
    label?: string
    width?: number
    height?: number
  }) => {
    const inline = isInlineCanvasMedia(payload.url)
      ? payload.url
      : (isInlineCanvasMedia(payload.base64) ? payload.base64 : '')
    const url = inline ? await uploadCanvasMediaUrl(inline) : payload.url
    const pixels = payload.width && payload.height
      ? { width: payload.width, height: payload.height }
      : null
    updateNode(id, {
      url,
      base64: undefined,
      thumbnail: undefined,
      label: payload.label || data.label || '图片节点',
      loading: false,
      updatedAt: Date.now(),
      ...nextMediaPixelFields(pixels),
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
        const pixels = await readBlobPixelSize(blob);
        const url = await uploadCanvasBlob(blob);
        await applyImageToNode({
          url,
          label: '粘贴图片',
          width: pixels?.width,
          height: pixels?.height,
        });
        message.success('已替换为剪贴板图片');
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
    setSaveCategory(undefined);
    setShowSaveToMaterialsModal(true);
  }, [closeContextMenu]);

  const handleSaveAsCharacter = useCallback(() => {
    closeContextMenu();
    setSaveCategory('character');
    setShowSaveToMaterialsModal(true);
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
        generating={Boolean(data?.loading)}
        label={data.label || '图片节点'}
        icon={<ImageIcon />}
        width={IMAGE_PREVIEW_WIDTH}
        resolution={data?.url ? frame.resolution : undefined}
        aspectRatio={
          data?.url
            ? cssAspectRatio(frame.aspect, IMAGE_EMPTY_ASPECT)
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
            key: 'preview',
            label: '预览',
            icon: <Eye className="h-4 w-4" />,
            onClick: (event) => {
              event.stopPropagation();
              setShowPreview(true);
            },
            hidden: !data?.url,
          },
          {
            key: 'save',
            label: '保存到素材库',
            icon: <FolderPlus className="h-4 w-4" />,
            onClick: handleSaveToMaterials,
            hidden: !data?.url,
          },
          { key: 'download', label: '下载', icon: <Download className="h-4 w-4" />, onClick: handleDownload, hidden: !data?.url },
          { key: 'duplicate', label: '复制', icon: <Copy className="h-4 w-4" />, onClick: handleDuplicate },
          { key: 'delete', label: '删除', icon: <Trash2 className="h-4 w-4" />, onClick: handleDelete, danger: true },
        ]}
      >
        {data?.loading ? (
          <MediaStageLoading
            kind="image"
            progress={readNodeProgress(data)}
            onCancel={bindNodeGenerationCancel(id, updateNode)}
          />
        ) : data?.url ? (
          <CanvasImagePreview
            nodeId={id}
            url={data.url}
            thumbnail={data.thumbnail}
            alt={data.label || '图片'}
            onOpenPreview={() => setShowPreview(true)}
            onMeasured={frame.reportMeasurement}
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
        nodeId={id}
        initialCategory={typeof data?.sourceType === 'string' ? data.sourceType : undefined}
        params={{
          prompt: data?.prompt,
          model: data?.model,
          ratio: nodeAspectRatio(data || {}),
          size: data?.size,
        }}
      />

      <SaveToMaterialsModal
        open={showSaveToMaterialsModal}
        onClose={() => {
          setShowSaveToMaterialsModal(false);
          setSaveCategory(undefined);
        }}
        imageUrl={mediaUrl(data?.url) || undefined}
        initialName={data?.label || '图片素材'}
        initialCategory={saveCategory ?? (typeof data?.sourceType === 'string' ? data.sourceType : undefined)}
        nodeId={id}
        prompt={typeof data?.prompt === 'string' ? data.prompt : undefined}
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
              <span>保存到素材库</span>
            </button>

            <button
              onClick={handleSaveAsCharacter}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] transition-colors hover:bg-black/5"
            >
              <AppstoreAddOutlined style={{ fontSize: 17 }} />
              <span>保存为角色</span>
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
