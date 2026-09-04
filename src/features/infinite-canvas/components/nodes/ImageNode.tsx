import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, NodeProps } from 'reactflow';
import { Upload, Spin, Tooltip, message, Input } from 'antd';
import { DeleteOutlined, DownloadOutlined, CopyOutlined, VideoCameraOutlined, PictureOutlined, BgColorsOutlined, EyeOutlined, FolderAddOutlined, AppstoreAddOutlined } from '@ant-design/icons';
import { useCanvasStore } from '../../stores/canvasStore';
import PreviewModal from '../PreviewModal';
import SaveToMaterialsModal from '../SaveToMaterialsModal';
import type { CanvasMaterialItem, CustomNode } from '../../types';
import { MATERIAL_DRAG_MIME } from '../MaterialPanel';

// 视频特效图标
const EffectIcon: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" style={style}>
    <path d="M7.5 5.6L5 7l1.4-2.5L5 2l2.5 1.4L10 2 8.6 4.5 10 7 7.5 5.6zm12 9.8L22 14l-1.4 2.5L22 19l-2.5-1.4L17 19l1.4-2.5L17 14l2.5 1.4zM22 2l-1.4 2.5L22 7l-2.5-1.4L17 7l1.4-2.5L17 2l2.5 1.4L22 2zm-8.66 10.78l2.44-2.44-2.12-2.12-2.44 2.44 2.12 2.12zm1.03-5.49l2.34 2.34c.39.37.39 1.02 0 1.41L5.04 22.71c-.39.39-1.04.39-1.41 0l-2.34-2.34c-.39-.39-.39-1.02 0-1.41L12.96 7.29c.39-.39 1.04-.39 1.41 0z"/>
  </svg>
);

// 自定义 Loading 动画组件
const ImageLoadingAnimation: React.FC = () => (
  <div className="aspect-square flex flex-col items-center justify-center rounded-lg overflow-hidden relative bg-gradient-to-br from-orange-50 to-stone-100">
    {/* Shimmer 效果 */}
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    
    {/* 图标和圆点 */}
    <div className="relative z-10 flex flex-col items-center gap-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center animate-pulse shadow-lg signature-gradient">
        <PictureOutlined className="text-white text-xl" />
      </div>
      <div className="flex gap-1.5">
        <span className="w-2 h-2 rounded-full animate-bounce bg-orange-300" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 rounded-full animate-bounce bg-orange-400" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 rounded-full animate-bounce bg-orange-500" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
);

const ImageNode: React.FC<NodeProps<CustomNode['data']>> = ({ id, data, selected }) => {
  const { updateNode, removeNode, duplicateNode, addNode, addEdgeManually, nodes } = useCanvasStore();
  const [uploading, setUploading] = useState(false);
  const [showTools, setShowTools] = useState(false);
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

  const handleLabelKeyDown = useCallback((e: React.KeyboardEvent) => {
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
    link.href = data.url;
    link.download = `image_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('下载成功');
  }, [data?.url]);

  const downloadImage = useCallback(() => {
    if (!data?.url) return;

    const link = document.createElement('a');
    link.href = data.url;
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

  const handleVideoGen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const currentNode = nodes.find((n) => n.id === id);
    const nodeX = currentNode?.position?.x || 0;
    const nodeY = currentNode?.position?.y || 0;

    const configNodeId = addNode('videoConfig', { x: nodeX + 400, y: nodeY }, { label: '图生视频' });
    addEdgeManually({ source: id, target: configNodeId });
  }, [id, nodes, addNode, addEdgeManually]);

  const handleImageGen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const currentNode = nodes.find((n) => n.id === id);
    const nodeX = currentNode?.position?.x || 0;
    const nodeY = currentNode?.position?.y || 0;

    const configNodeId = addNode('imageConfig', { x: nodeX + 400, y: nodeY - 100 }, { label: '图生图', model: 'wan2.6-image' });
    addEdgeManually({ source: id, target: configNodeId });
  }, [id, nodes, addNode, addEdgeManually]);

  const handleTemplateEffect = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const currentNode = nodes.find((n) => n.id === id);
    const nodeX = currentNode?.position?.x || 0;
    const nodeY = currentNode?.position?.y || 0;

    const configNodeId = addNode('templateEffect', { x: nodeX + 400, y: nodeY + 100 }, { label: '图生视频-特效' });
    addEdgeManually({ source: id, target: configNodeId });
  }, [id, nodes, addNode, addEdgeManually]);

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
    const response = await fetch(data.url);
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
      className="relative group pr-16"
      onMouseEnter={() => setShowTools(true)}
      onMouseLeave={() => setShowTools(false)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={handleContextMenu}
    >
      {/* Main node content */}
      <div
        className={`image-node rounded-xl border-2 ${
          isDropActive
            ? 'border-[hsl(var(--primary))] shadow-[0_0_0_3px_rgba(172,46,0,0.18)]'
            : selected
            ? 'border-[hsl(var(--primary))] shadow-[0_0_0_1px_rgba(172,46,0,0.24)]'
            : 'border-[var(--border-color)]'
        } shadow-lg w-[280px] transition-all duration-200 relative`}
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        {/* Handles */}
        <Handle type="target" position={Position.Left} className="!bg-[hsl(var(--primary))]" />
        <Handle type="source" position={Position.Right} className="!bg-[hsl(var(--primary))]" />

        {/* Header */}
        <div
          className={`flex items-center justify-between px-3 py-2 rounded-t-xl ${
            selected
              ? 'text-white'
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
              className="text-sm font-semibold cursor-pointer hover:opacity-80"
              onDoubleClick={handleLabelDoubleClick}
              title="双击编辑"
            >
              🖼️ {data.label}
            </span>
          )}
          <div className="flex items-center gap-1">
            {data?.url && (
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
        <div className="p-3" style={{ backgroundColor: 'var(--bg-primary)' }}>
          {isDropActive && (
            <div className="mb-3 rounded-lg border border-dashed border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/6 px-3 py-2 text-xs font-medium text-[hsl(var(--primary))]">
              松手替换为该素材
            </div>
          )}
          {data?.loading ? (
            <ImageLoadingAnimation />
          ) : data?.url ? (
            <div className="aspect-square rounded-lg overflow-hidden bg-[var(--bg-tertiary)]">
              <img
                src={data.url}
                alt={data.label}
                className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setShowPreview(true)}
              />
            </div>
          ) : (
            <Upload 
              accept="image/*" 
              showUploadList={false} 
              beforeUpload={handleUpload} 
              disabled={uploading}
              className="block w-full"
            >
              <div 
                className="w-full h-48 flex flex-col items-center justify-center rounded-lg border-2 border-dashed cursor-pointer hover:border-[var(--text-secondary)] transition-colors"
                style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}
              >
                {uploading ? (
                  <Spin size="large" />
                ) : (
                  <>
                    <PictureOutlined style={{ fontSize: 40, color: 'var(--text-secondary)' }} />
                    <p className="text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>拖放图片或点击上传</p>
                  </>
                )}
              </div>
            </Upload>
          )}

          {data?.error && (
            <div className="mt-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">{data.error}</div>
          )}
        </div>
      </div>
      
      {/* Tools on right side */}
      {showTools && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20">
          <Tooltip title="图生图" placement="right">
            <button
              onClick={handleImageGen}
              className="w-10 h-10 flex items-center justify-center rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer"
              style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
            >
              <BgColorsOutlined style={{ fontSize: 18 }} />
            </button>
          </Tooltip>
          <Tooltip title="图生视频" placement="right">
            <button
              onClick={handleVideoGen}
              className="w-10 h-10 flex items-center justify-center rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer"
              style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
            >
              <VideoCameraOutlined style={{ fontSize: 18 }} />
            </button>
          </Tooltip>
          <Tooltip title="视频特效" placement="right">
            <button
              onClick={handleTemplateEffect}
              className="w-10 h-10 flex items-center justify-center rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer"
              style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
            >
              <EffectIcon style={{ fontSize: 18 }} />
            </button>
          </Tooltip>
        </div>
      )}

      {/* Preview Modal */}
      <PreviewModal
        visible={showPreview}
        onClose={() => setShowPreview(false)}
        type="image"
        url={data?.url || ''}
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
        imageUrl={data?.url}
        initialName={data?.label || '图片素材'}
        initialCategory={data?.sourceType}
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
