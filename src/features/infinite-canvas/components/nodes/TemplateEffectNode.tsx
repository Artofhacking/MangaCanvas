import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Input, Select, Button, message } from 'antd';
import { DeleteOutlined, CopyOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useCanvasStore } from '../../stores/canvasStore';
import { useVideoGeneration } from '../../hooks';
import type { CustomNode } from '../../types';

// 分辨率选项
const RESOLUTION_OPTIONS = [
  { value: '720P', label: '720P' },
  { value: '1080P', label: '1080P' },
];

// 特效分组
const TEMPLATE_GROUPS = [
  {
    label: '通用特效',
    options: [
      { value: 'squish', label: '解压捏捏' },
      { value: 'rotation', label: '转圈圈' },
    ],
  },
  {
    label: '单人特效',
    options: [
      { value: 'singleheart', label: '爱你哟' },
      { value: 'dance1', label: '摇摆时刻' },
      { value: 'dance2', label: '头号甩舞' },
      { value: 'dance3', label: '星摇时刻' },
      { value: 'dance4', label: '指感节奏' },
      { value: 'dance5', label: '舞动开关' },
      { value: 'graduation', label: '学术加冕' },
      { value: 'money', label: '财从天降' },
    ],
  },
  {
    label: '单人或动物特效',
    options: [
      { value: 'flying', label: '魔法悬浮' },
      { value: 'rose', label: '赠人玫瑰' },
      { value: 'crystalrose', label: '闪亮玫瑰' },
    ],
  },
  {
    label: '双人特效',
    options: [
      { value: 'hug', label: '爱的抱抱' },
      { value: 'frenchkiss', label: '唇齿相依' },
      { value: 'coupleheart', label: '双倍心动' },
    ],
  },
];

const TemplateEffectNode: React.FC<NodeProps<CustomNode['data']>> = ({ id, data, selected }) => {
  const { nodes, edges, updateNode, addNode, addEdgeManually, duplicateNode, removeNode } = useCanvasStore();
  const { generate } = useVideoGeneration();

  const [localResolution, setLocalResolution] = useState<string>(data.resolution as string || '720P');
  const [localTemplate, setLocalTemplate] = useState<string>(data.template as string || '');

  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label || '图生视频-特效');

  // 同步数据到节点
  useEffect(() => {
    updateNode(id, {
      resolution: localResolution,
      template: localTemplate,
      model: 'wan2.6-i2v-flash',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localResolution, localTemplate]);

  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditLabel(data.label || '图生视频-特效');
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
      setEditLabel(data.label || '图生视频-特效');
    }
  }, [handleLabelBlur, data.label]);

  // 获取连接的图片输入
  const getConnectedImage = useMemo(() => {
    const incomingEdges = edges.filter((edge) => edge.target === id);
    let imageUrl = '';

    incomingEdges.forEach((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      if (sourceNode?.type === 'image') {
        imageUrl = sourceNode.data.url || sourceNode.data.base64 || '';
      }
    });

    return imageUrl;
  }, [edges, nodes, id]);

  // 获取特效模板名称
  const getTemplateLabel = (templateValue: string) => {
    for (const group of TEMPLATE_GROUPS) {
      const found = group.options.find(opt => opt.value === templateValue);
      if (found) return found.label;
    }
    return templateValue;
  };

  // 生成视频
  const handleGenerate = async () => {
    if (!localTemplate) {
      message.warning('请选择特效模板');
      return;
    }

    const imageUrl = getConnectedImage;
    if (!imageUrl) {
      message.warning('请连接图片节点');
      return;
    }

    const node = nodes.find((n) => n.id === id);
    if (!node) return;

    const outgoing = edges.filter((e) => e.source === id);
    const xOffset = outgoing.length * 320;

    const videoNodeId = addNode(
      'video',
      { x: node.position.x + 400 + xOffset, y: node.position.y },
      {
        label: getTemplateLabel(localTemplate),
        loading: true,
        model: 'wan2.6-i2v-flash',
        modelLabel: '万相 2.6 图生视频',
        template: localTemplate,
        templateLabel: getTemplateLabel(localTemplate),
        resolution: localResolution,
      }
    );

    addEdgeManually({ source: id, target: videoNodeId });

    try {
      const videoUrl = await generate({
        model: 'wan2.6-i2v-flash',
        prompt: '',
        first_frame_image: imageUrl,
        resolution: localResolution as string,
        template: localTemplate as string,
      });

      if (videoUrl) {
        updateNode(videoNodeId, { url: videoUrl, loading: false, updatedAt: Date.now() });
      } else {
        updateNode(videoNodeId, { loading: false, error: '生成失败' });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'API_RATE_LIMIT') {
        removeNode(videoNodeId);
        message.warning('请求过于频繁，请稍后重试');
      } else {
        updateNode(videoNodeId, { loading: false, error: '生成失败' });
      }
    }
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

  return (
    <div className="relative">
      <div
        className={`rounded-lg shadow-lg border-2 ${
          selected ? 'border-[hsl(var(--primary))] shadow-[0_0_0_1px_rgba(172,46,0,0.24)]' : 'border-[var(--border-color)]'
        } min-w-[280px] transition-colors relative`}
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        {/* Handles */}
        <Handle type="target" position={Position.Left} className="!bg-[hsl(var(--primary))]" />
        <Handle type="source" position={Position.Right} className="!bg-[hsl(var(--primary))]" />

        {/* Header */}
        <div
          className={`px-4 py-2 font-semibold rounded-t-md flex items-center justify-between ${
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
              className="cursor-pointer hover:opacity-80"
              onDoubleClick={handleLabelDoubleClick}
              title="双击编辑"
            >
              🎬 {data.label || '图生视频-特效'}
            </span>
          )}
          <div className="flex items-center gap-1">
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
        <div className="p-4 space-y-3 nodrag">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              分辨率
            </label>
            <Select
              value={localResolution}
              onChange={setLocalResolution}
              style={{ width: '100%' }}
              options={RESOLUTION_OPTIONS}
              popupClassName="nodrag nowheel"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              特效模板
            </label>
            <Select
              value={localTemplate}
              onChange={setLocalTemplate}
              style={{ width: '100%' }}
              options={TEMPLATE_GROUPS}
              popupClassName="nodrag nowheel"
              placeholder="选择特效模板"
              showSearch
              optionFilterProp="label"
            />
          </div>

          {/* 生成按钮 */}
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleGenerate}
            block
          >
            生成视频
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TemplateEffectNode;
