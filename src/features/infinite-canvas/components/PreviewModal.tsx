import React from 'react';
import { Modal } from 'antd';
import { CloseOutlined, DownloadOutlined } from '@ant-design/icons';

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
}

const PreviewModal: React.FC<PreviewModalProps> = ({
  visible,
  onClose,
  type,
  url,
  title = '预览',
  onDownload,
  params,
}) => {
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

  const hasParams = params && (params.prompt || params.model);

  // 阻止右键事件
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
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
              onClick={handleDownload}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors cursor-pointer"
              title="下载"
            >
              <DownloadOutlined className="text-white" />
            </button>
            <button
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
                src={url}
                alt={title}
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
              />
            ) : (
              <video
                src={url}
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
  );
};

export default PreviewModal;
