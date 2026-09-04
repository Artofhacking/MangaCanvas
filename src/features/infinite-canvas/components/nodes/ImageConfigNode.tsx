import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Button, Select, message, Input } from 'antd';
import { ThunderboltOutlined, CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import { useCanvasStore } from '../../stores/canvasStore';
import { useImageGeneration } from '../../hooks';
import { IMAGE_MODELS } from '../../config/models';
import { isI2IModel } from '@/api/aigc';
import type { CustomNode } from '../../types';

// 画面比例选项
const ASPECT_RATIOS = ['16:9', '4:3', '1:1', '3:4', '9:16'];

// 从尺寸字符串解析比例
const getSizeRatio = (size: string): string => {
  const ratioMap: Record<string, string> = {
    '1280*1280': '1:1', '1024*1024': '1:1', '1440*1440': '1:1', '960*960': '1:1',
    '1696*960': '16:9', '1280*720': '16:9',
    '960*1696': '9:16', '720*1280': '9:16',
    '1472*1104': '4:3', '1280*960': '4:3', '1088*832': '4:3',
    '1104*1472': '3:4', '960*1280': '3:4', '832*1088': '3:4',
    '1200*800': '3:2', '800*1200': '2:3', '1344*576': '21:9',
  };
  return ratioMap[size] || '1:1';
};

// 从模型名称提取简短标签（如"万相 2.6 文生图" -> "文生图"）
const getShortLabelFromModel = (modelLabel: string): string => {
  const match = modelLabel.match(/[文图]生[图视频]+|关键帧生视频/);
  return match ? match[0] : '文生图';
};

const ImageConfigNode: React.FC<NodeProps<CustomNode['data']>> = ({ id, data, selected }) => {
  const { nodes, edges, updateNode, addNode, addEdgeManually, duplicateNode, removeNode } = useCanvasStore();
  const { generate } = useImageGeneration();
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label || '文生图');

  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditLabel(data.label || '文生图');
    setIsEditingLabel(true);
  }, [data.label]);

  const handleLabelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditLabel(e.target.value);
  }, []);

  const handleLabelBlur = useCallback(() => {
    setIsEditingLabel(false);
    if (editLabel.trim() && editLabel !== data.label) {
      updateNode(id, { label: editLabel.trim(), isLabelCustomized: true });
    }
  }, [editLabel, data.label, id, updateNode]);

  const handleLabelKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLabelBlur();
    } else if (e.key === 'Escape') {
      setIsEditingLabel(false);
      setEditLabel(data.label || '文生图');
    }
  }, [handleLabelBlur, data.label]);

  // Get initial model and its default params
  const getInitialValues = () => {
    const modelKey = data.model || 'wan2.6-t2i';
    const model = IMAGE_MODELS.find((m) => m.key === modelKey);
    return {
      model: modelKey,
      quality: data.quality || model?.defaultParams?.quality || 'standard',
      size: data.size || model?.defaultParams?.size || '1280*1280',
    };
  };

  const initialValues = getInitialValues();
  const [localModel, setLocalModel] = useState(initialValues.model);
  const [localQuality, setLocalQuality] = useState(initialValues.quality);
  const [localSize, setLocalSize] = useState(initialValues.size);
  const [localRatio, setLocalRatio] = useState(getSizeRatio(initialValues.size));

  const currentModel = useMemo(() => IMAGE_MODELS.find((m) => m.key === localModel), [localModel]);
  const isI2I = useMemo(() => isI2IModel(localModel), [localModel]);
  
  // Get size options based on current model and quality
  const sizeOptions = useMemo(() => {
    if (!currentModel?.getSizesByQuality) return [];
    return currentModel.getSizesByQuality(localQuality);
  }, [currentModel, localQuality]);

  // Sync size when options change and current size is not in options
  useEffect(() => {
    if (sizeOptions.length > 0 && !sizeOptions.find(s => s.key === localSize)) {
      setLocalSize(sizeOptions[0].key);
      updateNode(id, { size: sizeOptions[0].key });
    }
  }, [sizeOptions, localSize, id, updateNode]);

  const handleModelChange = (value: string) => {
    setLocalModel(value);
    const model = IMAGE_MODELS.find((m) => m.key === value);
    if (model?.defaultParams) {
      const newQuality = model.defaultParams.quality || 'standard';
      const newSize = model.defaultParams.size || '1280*1280';
      setLocalQuality(newQuality);
      setLocalSize(newSize);
      
      // 如果用户没有自定义名称，则跟随模型更新节点名称
      const updateData: Record<string, string | boolean | undefined> = {
        model: value,
        quality: newQuality,
        size: newSize,
      };
      
      if (!data.isLabelCustomized) {
        const shortLabel = getShortLabelFromModel(model.label);
        updateData.label = shortLabel;
        setEditLabel(shortLabel);
      }
      
      updateNode(id, updateData);
    }
  };

  // 根据比例选择尺寸
  const handleRatioChange = (ratio: string) => {
    setLocalRatio(ratio);
    // 找到对应比例的第一个尺寸
    const matchingSize = sizeOptions.find(s => getSizeRatio(s.key) === ratio);
    if (matchingSize) {
      setLocalSize(matchingSize.key);
      updateNode(id, { size: matchingSize.key });
    }
  };

  // Get connected inputs
  const getConnectedInputs = () => {
    const incomingEdges = edges.filter((edge) => edge.target === id);
    const prompts: string[] = [];
    const refImages: string[] = [];
    const effectParams: { style?: string; lighting?: string; effect?: string } = {};

    incomingEdges.forEach((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      if (!sourceNode) return;

      if (sourceNode.type === 'text') {
        const content = sourceNode.data.content;
        if (content) prompts.push(content);
      } else if (sourceNode.type === 'image') {
        const imageUrl = sourceNode.data.url || sourceNode.data.base64;
        if (imageUrl) refImages.push(imageUrl);
      } else if (sourceNode.type === 'effectConfig') {
        // 收集效果配置参数（图片不包含运镜）
        if (sourceNode.data.style) effectParams.style = sourceNode.data.style as string;
        if (sourceNode.data.lighting) effectParams.lighting = sourceNode.data.lighting as string;
        if (sourceNode.data.effect) effectParams.effect = sourceNode.data.effect as string;
      }
    });

    // 将效果参数转换为提示词后缀
    const effectSuffix = [
      effectParams.style,
      effectParams.lighting,
      effectParams.effect,
    ].filter(Boolean).join('，');

    // 合并提示词和效果参数
    let finalPrompt = prompts.join('\n\n');
    if (effectSuffix && finalPrompt) {
      finalPrompt = `${finalPrompt}，${effectSuffix}`;
    } else if (effectSuffix) {
      finalPrompt = effectSuffix;
    }

    return { prompt: finalPrompt, prompts, refImages, effectParams };
  };

  const handleGenerate = async () => {
    const { prompt, refImages } = getConnectedInputs();

    // 图生图模式需要参考图片
    if (isI2I && refImages.length === 0) {
      message.warning('图生图模式需要连接图片节点（参考图）');
      return;
    }

    // 文生图模式需要提示词
    if (!isI2I && !prompt) {
      message.warning('请连接文本节点（提示词）');
      return;
    }

    // 始终创建新节点，支持并发生成
    const node = nodes.find((n) => n.id === id);
    if (!node) return;

    const outgoing = edges.filter((e) => e.source === id);
    const xOffset = outgoing.length * 320;

    // 获取模型名称
    const modelLabel = IMAGE_MODELS.find(m => m.key === localModel)?.label || localModel;

    const imageNodeId = addNode(
      'image',
      { x: node.position.x + 400 + xOffset, y: node.position.y },
      { 
        url: '', 
        loading: true, 
        label: '图像生成结果',
        // 保存生成参数
        prompt: prompt || '',
        model: localModel,
        modelLabel,
        size: localSize,
        ratio: localRatio,
      }
    );

    addEdgeManually({ source: id, target: imageNodeId });

    try {
      // Generate image
      const result = await generate({
        model: localModel,
        prompt,
        size: localSize,
        quality: localQuality,
        image: refImages[0],
        images: isI2I ? refImages : undefined,
        n: 1,
      });

      if (result && result.length > 0) {
        updateNode(imageNodeId, {
          url: result[0],
          loading: false,
          updatedAt: Date.now(),
        });
        message.success('图片生成成功！');
      } else {
        updateNode(imageNodeId, {
          loading: false,
          error: '生成失败',
        });
      }
    } catch (err: unknown) {
      // 处理 429 错误 - 删除节点并显示友好提示
      if (err instanceof Error && err.message === 'API_RATE_LIMIT') {
        removeNode(imageNodeId);
        message.warning('请求过于频繁，请稍后重试');
      } else {
        updateNode(imageNodeId, {
          loading: false,
          error: '生成失败',
        });
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
      {/* Main node content */}
      <div
        className={`rounded-lg shadow-lg border-2 ${
          selected ? 'border-[hsl(var(--primary))] shadow-[0_0_0_1px_rgba(172,46,0,0.24)]' : 'border-[var(--border-color)]'
        } min-w-[320px] transition-colors relative`}
        style={{ 
          backgroundColor: 'var(--bg-primary, var(--ic-surface-container-lowest, #ffffff))',
          borderColor: selected ? undefined : 'var(--border-color, var(--ic-outline-variant, rgba(26,26,26,0.18)))',
        }}
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
          style={selected ? { background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, #d73b00 100%)' } : { backgroundColor: 'var(--bg-secondary, var(--ic-surface-container-low, #f4efe9))', color: 'var(--text-primary, var(--ic-on-surface, #1f1f1f))' }}
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
              🎨 {data.label || '文生图'}
            </span>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={handleDelete}
              className="p-1 hover:bg-black/10 rounded transition-colors cursor-pointer"
              title="删除"
              style={{ color: 'var(--text-primary, var(--ic-on-surface, #1f1f1f))' }}
            >
              <DeleteOutlined style={{ fontSize: 14 }} />
            </button>
            <button
              onClick={handleDuplicate}
              className="p-1 hover:bg-black/10 rounded transition-colors cursor-pointer"
              title="复制"
              style={{ color: 'var(--text-primary, var(--ic-on-surface, #1f1f1f))' }}
            >
              <CopyOutlined style={{ fontSize: 14 }} />
            </button>
          </div>
        </div>

      <div className="p-4 space-y-3 nodrag">
        {/* Model Selection */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary, var(--ic-on-surface, #1f1f1f))' }}>
            模型
          </label>
          <Select
            value={localModel}
            onChange={handleModelChange}
            style={{ width: '100%' }}
            options={IMAGE_MODELS.map((m) => ({ label: m.label, value: m.key }))}
            popupClassName="nodrag nowheel"
          />
        </div>

        {/* Aspect Ratio Selection */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary, var(--ic-on-surface, #1f1f1f))' }}>
            画面比例
          </label>
          <div className="flex gap-1.5">
            {ASPECT_RATIOS.map((ratio) => {
              const isSelected = localRatio === ratio;
              // 根据比例设置图标大小
              const getIconSize = () => {
                switch (ratio) {
                  case '16:9': return { w: 20, h: 11 };
                  case '9:16': return { w: 11, h: 20 };
                  case '4:3': return { w: 16, h: 12 };
                  case '3:4': return { w: 12, h: 16 };
                  case '1:1': return { w: 14, h: 14 };
                  default: return { w: 14, h: 14 };
                }
              };
              const iconSize = getIconSize();
              // 检查当前模型是否支持该比例
              const isSupported = sizeOptions.some(s => getSizeRatio(s.key) === ratio);
              return (
                <button
                  key={ratio}
                  onClick={() => isSupported && handleRatioChange(ratio)}
                  disabled={!isSupported}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-all border ${
                    isSelected
                      ? 'bg-[hsl(var(--primary))]/10 border-[hsl(var(--primary))]'
                      : isSupported
                        ? 'border-[var(--border-color)] hover:border-[hsl(var(--primary))]/40'
                        : 'border-[var(--border-color)] opacity-30 cursor-not-allowed'
                  }`}
                  style={!isSelected ? { backgroundColor: 'var(--bg-secondary, var(--ic-surface-container-low, #f4efe9))' } : undefined}
                >
                  <div
                    className="rounded-sm border-2"
                    style={{ 
                      width: iconSize.w, 
                      height: iconSize.h,
                      borderColor: isSelected ? 'hsl(var(--primary))' : 'var(--text-secondary, var(--ic-on-surface-variant, #6b6b6b))',
                    }}
                  />
                  <span 
                    className="text-xs"
                    style={{ 
                      color: isSelected ? 'hsl(var(--primary))' : 'var(--text-secondary, var(--ic-on-surface-variant, #6b6b6b))',
                      fontWeight: isSelected ? 500 : 400,
                    }}
                  >
                    {ratio}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Generate Button */}
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={handleGenerate}
          block
        >
          生成图片
        </Button>
      </div>
      </div>

    </div>
  );
};

export default ImageConfigNode;
