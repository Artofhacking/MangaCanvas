import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { message, Input } from 'antd';
import { CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import { useShallow } from 'zustand/react/shallow';
import { useCanvasStore } from '../../stores/canvasStore';
import { useVideoModels } from '../../hooks';
import { VIDEO_MODELS, remapVideoModel, resolvePickerModels } from '../../config/models';
import { isT2VModel, isKF2VModel, isSeedanceModel, isMiniMaxModel } from '@/api/aigc';
import type { CustomNode } from '../../types';
import NodeSelect from '../NodeSelect';

// 尺寸映射表
const SIZE_MAP: Record<string, Record<string, string>> = {
  '720P': {
    '16:9': '1280*720',
    '9:16': '720*1280',
    '1:1': '960*960',
    '4:3': '1088*832',
    '3:4': '832*1088',
  },
  '1080P': {
    '16:9': '1920*1080',
    '9:16': '1080*1920',
    '1:1': '1440*1440',
    '4:3': '1632*1248',
    '3:4': '1248*1632',
  },
};

const ASPECT_RATIOS = ['16:9', '4:3', '1:1', '3:4', '9:16'];
const RESOLUTIONS = ['1080P', '720P'];

const VideoConfigNode: React.FC<NodeProps<CustomNode['data']>> = ({ id, data, selected }) => {
  const { updateNode, duplicateNode, removeNode } = useCanvasStore(
    useShallow((state) => ({
      updateNode: state.updateNode,
      duplicateNode: state.duplicateNode,
      removeNode: state.removeNode,
    }))
  );
  const { models: liveVideoModels, loading: liveModelsLoading } = useVideoModels();
  const pickerModels = useMemo(
    () => resolvePickerModels(VIDEO_MODELS, liveVideoModels.map((item) => item.id), liveModelsLoading),
    [liveVideoModels, liveModelsLoading]
  );
  const incomingImageCount = useCanvasStore(
    (state) => state.edges.filter((edge) => edge.target === id && state.nodes.some((node) => node.id === edge.source && node.type === 'image')).length
  )
  const modelOptions = useMemo(
    () => {
      const options = pickerModels.map((item) => ({ label: item.label, value: item.key }))
      if (incomingImageCount > 0) {
        return options
          .filter((item) => !item.value.includes('t2v'))
          .map((item) => (item.value.includes('i2v') ? { ...item, label: '视频' } : item))
      }
      return options
    },
    [pickerModels, incomingImageCount]
  );
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label || '视频节点');

  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditLabel(data.label || '视频节点');
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
      setEditLabel(data.label || '视频节点');
    }
  }, [handleLabelBlur, data.label]);

  // Get initial values based on model
  const getInitialValues = () => {
    const modelKey = remapVideoModel(data.model);
    const model = VIDEO_MODELS.find((m) => m.key === modelKey);
    return {
      model: modelKey,
      size: data.size || model?.defaultParams?.size || '1280*720',
      resolution: data.resolution || model?.defaultParams?.resolution || '720P',
      duration: data.duration || model?.defaultParams?.duration || 5,
    };
  };

  const initialValues = getInitialValues();
  const [localModel, setLocalModel] = useState<string>(initialValues.model as string);
  const [localSize, setLocalSize] = useState<string>(initialValues.size as string);
  const [localResolution, setLocalResolution] = useState<string>(initialValues.resolution as string);
  const [localDuration, setLocalDuration] = useState<number>(initialValues.duration as number);
  
  // T2V 独立的分辨率和比例状态
  const [t2vResolution, setT2vResolution] = useState('720P');
  const [t2vAspectRatio, setT2vAspectRatio] = useState('16:9');

  // 初始化 T2V 状态
  useEffect(() => {
    if (initialValues.size) {
      // 从 size 解析出分辨率和比例
      for (const res of RESOLUTIONS) {
        for (const ratio of ASPECT_RATIOS) {
          if (SIZE_MAP[res][ratio] === initialValues.size) {
            setT2vResolution(res);
            setT2vAspectRatio(ratio);
            break;
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentModel = useMemo(() => VIDEO_MODELS.find((m) => m.key === localModel), [localModel]);
  const isT2V = useMemo(() => isT2VModel(localModel), [localModel]);
  const isKF2V = useMemo(() => isKF2VModel(localModel), [localModel]);
  const availableResolutions = useMemo(() => {
    if (isSeedanceModel(localModel) && (localModel.includes('fast') || localModel.includes('mini'))) {
      return ['720P'];
    }
    if (isMiniMaxModel(localModel) && /h3-max/i.test(localModel)) {
      return ['720P'];
    }
    return RESOLUTIONS;
  }, [localModel]);

  useEffect(() => {
    if (liveModelsLoading || pickerModels.length === 0) return
    if (pickerModels.some((model) => model.key === localModel)) return
    const next = pickerModels[0]
    if (!next || next.key === localModel) return
    setLocalModel(next.key)
    updateNode(id, { model: next.key })
  }, [liveModelsLoading, pickerModels, localModel, id, updateNode])

  useEffect(() => {
    if (availableResolutions.includes(t2vResolution)) return
    const next = availableResolutions[0] || '720P'
    if (next === t2vResolution) return
    const newSize = SIZE_MAP[next]?.[t2vAspectRatio] || SIZE_MAP[next]?.['16:9'] || '1280*720'
    setT2vResolution(next)
    setLocalSize(newSize)
    setLocalResolution(next)
    updateNode(id, { size: newSize, resolution: next })
  }, [availableResolutions, t2vResolution, t2vAspectRatio, id, updateNode])

  useEffect(() => {
    const durs = currentModel?.durs?.map((item) => item.key) || []
    if (!durs.length || durs.includes(localDuration)) return
    const next = durs[0]
    if (next === localDuration) return
    setLocalDuration(next)
    updateNode(id, { duration: next })
  }, [currentModel, localDuration, id, updateNode])

  useEffect(() => {
    if (typeof data.model === 'string' && data.model) {
      const nextModel = remapVideoModel(data.model)
      if (nextModel !== localModel) setLocalModel(nextModel)
    }
    if (typeof data.size === 'string' && data.size && data.size !== localSize) {
      setLocalSize(data.size)
    }
    if (typeof data.resolution === 'string' && data.resolution && data.resolution !== localResolution) {
      setLocalResolution(data.resolution)
    }
    if (typeof data.duration === 'number' && data.duration && data.duration !== localDuration) {
      setLocalDuration(data.duration)
    }
  }, [data.duration, data.model, data.resolution, data.size, localDuration, localModel, localResolution, localSize])

  // Handle model change
  const handleModelChange = (value: string) => {
    setLocalModel(value);
    const model = VIDEO_MODELS.find((m) => m.key === value);
    if (model?.defaultParams) {
      let newSize = (model.defaultParams.size || '1280*720') as string;
      let newResolution = (model.defaultParams.resolution || '720P') as string;
      const newDuration = (model.defaultParams.duration || 5) as number;
      let res = '720P';
      let ratio = '16:9';
      for (const candidate of RESOLUTIONS) {
        for (const aspect of ASPECT_RATIOS) {
          if (SIZE_MAP[candidate][aspect] === newSize) {
            res = candidate;
            ratio = aspect;
          }
        }
      }
      const seedanceLimited =
        (isSeedanceModel(value) && (value.includes('fast') || value.includes('mini'))) ||
        (isMiniMaxModel(value) && /h3-max/i.test(value));
      if (seedanceLimited) {
        res = '720P';
        newResolution = '720P';
        newSize = SIZE_MAP[res][ratio] || '1280*720';
      }
      setT2vResolution(res);
      setT2vAspectRatio(ratio);
      setLocalSize(newSize);
      setLocalResolution(newResolution);
      setLocalDuration(newDuration);
      updateNode(id, {
        model: value,
        size: newSize,
        resolution: newResolution,
        duration: newDuration,
      });
    }
  };

  // T2V 分辨率改变
  const handleT2vResolutionChange = (res: string) => {
    setT2vResolution(res);
    const newSize = SIZE_MAP[res][t2vAspectRatio];
    setLocalSize(newSize);
    updateNode(id, { size: newSize });
  };

  // T2V 比例改变
  const handleT2vAspectRatioChange = (ratio: string) => {
    setT2vAspectRatio(ratio);
    const newSize = SIZE_MAP[t2vResolution][ratio];
    setLocalSize(newSize);
    updateNode(id, { size: newSize });
  };

  const handleResolutionChange = (value: string) => {
    setLocalResolution(value);
    updateNode(id, { resolution: value });
  };

  const handleDurationChange = (value: number) => {
    setLocalDuration(value);
    updateNode(id, { duration: value });
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
        {isKF2V ? (
          <>
            <Handle 
              type="target" 
              position={Position.Left} 
              id="prompt"
              className="!bg-[hsl(var(--primary))]"
              title="提示词"
            />
            <Handle 
              type="target" 
              position={Position.Left} 
              id="first-frame"
              className="!bg-green-500"
              style={{ top: 140 }}
              title="首帧"
            />
            <Handle 
              type="target" 
              position={Position.Left} 
              id="last-frame"
              className="!bg-orange-500"
              style={{ top: 168 }}
              title="尾帧"
            />
          </>
        ) : (
          <Handle type="target" position={Position.Left} className="!bg-[hsl(var(--primary))]" />
        )}
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
              🎬 {data.label || '视频节点'}
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
          {incomingImageCount > 0 ? (
            <div className="text-xs leading-5" style={{ color: 'var(--text-secondary, var(--ic-on-surface-variant, #6b6b6b))' }}>
              已连接 {incomingImageCount} 张参考图，用底部生成栏发送
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary, var(--ic-on-surface, #1f1f1f))' }}>
                模型
              </label>
              <NodeSelect
                value={modelOptions.some((item) => item.value === localModel) ? localModel : modelOptions[0]?.value}
                onChange={(next) => handleModelChange(String(next))}
                options={modelOptions}
                placeholder={liveModelsLoading ? '检测可用模型...' : '暂无可用模型'}
                loading={liveModelsLoading}
              />
            </div>
          )}

          {/* 关键帧模式标签 */}
          {isKF2V && (
            <div className="space-y-1">
              <div className="h-6 flex items-center">
                <span className="text-xs" style={{ color: 'var(--text-secondary, var(--ic-on-surface-variant, #6b6b6b))' }}>首帧</span>
              </div>
              <div className="h-6 flex items-center">
                <span className="text-xs" style={{ color: 'var(--text-secondary, var(--ic-on-surface-variant, #6b6b6b))' }}>尾帧</span>
              </div>
            </div>
          )}

          {/* Size Selection (T2V) or Resolution Selection (I2V) */}
          {isT2V ? (
            <>
              {/* 分辨率选择 */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary, var(--ic-on-surface, #1f1f1f))' }}>
                  分辨率
                </label>
                <div className="flex gap-2">
                  {availableResolutions.map((res) => (
                    <button
                      key={res}
                      onClick={() => handleT2vResolutionChange(res)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border ${
                        t2vResolution === res
                          ? 'bg-white text-black border-white'
                          : 'text-[var(--text-secondary)] border-[var(--border-color)] hover:border-white/60'
                      }`}
                      style={t2vResolution !== res ? { backgroundColor: 'var(--bg-secondary, var(--ic-surface-container-low, #f4efe9))' } : undefined}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>

              {/* 画面比例选择 */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary, var(--ic-on-surface, #1f1f1f))' }}>
                  画面比例
                </label>
                <div className="flex gap-1.5">
                  {ASPECT_RATIOS.map((ratio) => {
                    const isSelected = t2vAspectRatio === ratio;
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
                    return (
                      <button
                        key={ratio}
                        onClick={() => handleT2vAspectRatioChange(ratio)}
                        className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-all border ${
                          isSelected
                            ? 'bg-[hsl(var(--primary))]/10 border-[hsl(var(--primary))]'
                            : 'border-[var(--border-color)] hover:border-[hsl(var(--primary))]/40'
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
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary, var(--ic-on-surface, #1f1f1f))' }}>
                分辨率
              </label>
              <div className="flex gap-2">
                {['1080P', '720P'].map((res) => (
                  <button
                    key={res}
                    onClick={() => handleResolutionChange(res)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border ${
                      localResolution === res
                        ? 'text-white border-[hsl(var(--primary))]'
                        : 'text-[var(--text-secondary)] border-[var(--border-color)] hover:border-white/60'
                    }`}
                    style={localResolution === res ? { backgroundColor: 'hsl(var(--primary))' } : { backgroundColor: 'var(--bg-secondary, var(--ic-surface-container-low, #f4efe9))' }}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Duration Selection */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary, var(--ic-on-surface, #1f1f1f))' }}>
              时长
            </label>
            <NodeSelect
              value={
                currentModel?.durs?.some((item) => item.key === localDuration)
                  ? localDuration
                  : currentModel?.durs?.[0]?.key
              }
              onChange={(next) => handleDurationChange(Number(next))}
              options={currentModel?.durs?.map((item) => ({ label: item.label, value: item.key })) || []}
              placeholder="选择时长"
            />
          </div>

          <div
            className="rounded-lg px-3 py-2 text-[11px] leading-5"
            style={{
              backgroundColor: 'var(--bg-secondary, var(--ic-surface-container-low, #f4efe9))',
              color: 'var(--text-secondary, var(--ic-on-surface-variant, #6b6b6b))',
            }}
          >
            选中后用底部生成栏发送
          </div>
        </div>
      </div>

    </div>
  );
};

export default VideoConfigNode;
