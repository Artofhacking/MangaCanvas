import React, { useState, useMemo } from 'react';
import { Modal, Checkbox, Button, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { CustomNode } from '../types';

interface DownloadModalProps {
  visible: boolean;
  onClose: () => void;
  nodes: CustomNode[];
}

const DownloadModal: React.FC<DownloadModalProps> = ({ visible, onClose, nodes }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [downloading, setDownloading] = useState(false);

  // Filter nodes with content (images and videos)
  const downloadableNodes = useMemo(() => {
    return nodes.filter((node) => {
      if (node.type === 'image' && node.data.url) return true;
      if (node.type === 'video' && node.data.url) return true;
      return false;
    });
  }, [nodes]);

  const handleDownload = async () => {
    if (selectedIds.length === 0) {
      message.warning('请至少选择一个文件');
      return;
    }

    setDownloading(true);

    try {
      if (selectedIds.length === 1) {
        // Single file download
        const node = nodes.find((n) => n.id === selectedIds[0]);
        if (!node?.data.url) return;

        const link = document.createElement('a');
        link.href = node.data.url;
        link.download = `${node.type}_${Date.now()}.${node.type === 'video' ? 'mp4' : 'png'}`;
        link.click();
        message.success('下载成功');
      } else {
        // Multiple files - create zip
        const zip = new JSZip();

        for (const id of selectedIds) {
          const node = nodes.find((n) => n.id === id);
          if (!node?.data.url) continue;

          try {
            const response = await fetch(node.data.url);
            const blob = await response.blob();
            const ext = node.type === 'video' ? 'mp4' : 'png';
            zip.file(`${node.type}_${node.id}.${ext}`, blob);
          } catch (error) {
            console.error(`Failed to download ${node.id}:`, error);
          }
        }

        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, `canvas_export_${Date.now()}.zip`);
        message.success('批量下载成功');
      }

      onClose();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '下载失败');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal
      title="批量下载"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="download"
          type="primary"
          icon={<DownloadOutlined />}
          onClick={handleDownload}
          loading={downloading}
          disabled={selectedIds.length === 0}
        >
          下载 ({selectedIds.length})
        </Button>,
      ]}
      width={600}
    >
      <div className="space-y-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          选择要下载的图片和视频，支持批量打包下载
        </div>

        <div className="max-h-96 overflow-y-auto space-y-2">
          {downloadableNodes.length === 0 ? (
            <div className="text-center py-8 text-gray-400">暂无可下载的内容</div>
          ) : (
            downloadableNodes.map((node) => (
              <div
                key={node.id}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <Checkbox
                  checked={selectedIds.includes(node.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds([...selectedIds, node.id]);
                    } else {
                      setSelectedIds(selectedIds.filter((id) => id !== node.id));
                    }
                  }}
                />
                {node.type === 'image' ? (
                  <img
                    src={node.data.url}
                    alt={node.data.label}
                    className="w-16 h-16 object-cover rounded"
                  />
                ) : (
                  <video
                    src={node.data.url}
                    className="w-16 h-16 object-cover rounded"
                  />
                )}
                <div className="flex-1">
                  <div className="text-sm font-medium">{node.data.label}</div>
                  <div className="text-xs text-gray-500">
                    {node.type === 'image' ? '图片' : '视频'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {downloadableNodes.length > 0 && (
          <div className="flex gap-2">
            <Button
              size="small"
              onClick={() => setSelectedIds(downloadableNodes.map((n) => n.id))}
            >
              全选
            </Button>
            <Button size="small" onClick={() => setSelectedIds([])}>
              清空
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default DownloadModal;
