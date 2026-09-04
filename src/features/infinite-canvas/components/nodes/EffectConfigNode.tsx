import React, { useState, useCallback, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Input, Select, message } from 'antd';
import { DeleteOutlined, CopyOutlined } from '@ant-design/icons';
import { useCanvasStore } from '../../stores/canvasStore';
import type { CustomNode } from '../../types';

// 风格选项
const STYLE_OPTIONS = [
  { value: '', label: '默认' },
  { value: '国风水墨', label: '国风水墨' },
  { value: '写实CG渲染', label: '写实CG' },
  { value: '赛博朋克', label: '赛博朋克' },
  { value: '新中式风格', label: '新中式' },
  { value: '敦煌壁画风', label: '敦煌壁画' },
  { value: '二次元动漫', label: '二次元' },
  { value: '科幻机甲风', label: '科幻机甲' },
  { value: '油画风格', label: '油画风格' },
  { value: '水彩画风', label: '水彩画风' },
  { value: '极简主义', label: '极简主义' },
];

// 光影选项
const LIGHTING_OPTIONS = [
  { value: '', label: '默认' },
  { value: '清晨柔和的晨光', label: '晨光' },
  { value: '落日余晖，金色光线', label: '落日' },
  { value: '赛博霓虹光影', label: '霓虹' },
  { value: '体积光穿过森林', label: '体积光' },
  { value: '烛光摇曳，温暖氛围', label: '烛光' },
  { value: '月光照耀，冷色调', label: '月光' },
  { value: '戏剧性侧光', label: '侧光' },
  { value: '逆光剪影效果', label: '逆光' },
  { value: '柔和漫射光', label: '柔光' },
];

// 运镜选项（仅视频使用）
const CAMERA_OPTIONS = [
  { value: '', label: '默认' },
  // 基础运镜
  { value: '缓慢推进镜头', label: '推进' },
  { value: '缓慢拉远镜头', label: '拉远' },
  { value: '水平向左横移镜头', label: '左移' },
  { value: '水平向右横移镜头', label: '右移' },
  { value: '镜头缓慢上升', label: '上升' },
  { value: '镜头缓慢下降', label: '下降' },
  // 旋转运镜
  { value: '镜头向左旋转45度', label: '左旋45°' },
  { value: '镜头向右旋转45度', label: '右旋45°' },
  { value: '镜头顺时针旋转', label: '顺时针旋转' },
  { value: '镜头逆时针旋转', label: '逆时针旋转' },
  { value: '环绕主体360度拍摄', label: '环绕360°' },
  // 视角切换
  { value: '俯视角度拍摄', label: '俯视' },
  { value: '仰视角度拍摄', label: '仰视' },
  { value: '广角镜头拍摄', label: '广角' },
  { value: '特写镜头拍摄', label: '特写' },
  { value: '鱼眼镜头效果', label: '鱼眼' },
  // 组合运镜
  { value: '推进同时左旋', label: '推进+左旋' },
  { value: '推进同时右旋', label: '推进+右旋' },
  { value: '拉远同时上升', label: '拉远+上升' },
  { value: '跟随主体运动', label: '跟随' },
  // 特殊效果
  { value: '快速变焦冲击', label: '变焦冲击' },
  { value: '平稳摇镜', label: '摇镜' },
  { value: '手持晃动效果', label: '手持晃动' },
  { value: '固定机位拍摄', label: '固定' },
];

// 特效选项
const EFFECT_OPTIONS = [
  { value: '', label: '默认' },
  { value: '电影胶片质感', label: '胶片' },
  { value: '梦幻虚化效果', label: '梦幻' },
  { value: '复古怀旧色调', label: '复古' },
  { value: '高对比度', label: '高对比' },
  { value: '莫兰迪色系', label: '莫兰迪' },
  { value: '黑白电影风', label: '黑白' },
  { value: '景深虚化', label: '景深' },
  { value: '动态模糊', label: '动态模糊' },
  { value: '颗粒质感', label: '颗粒' },
];

const EffectConfigNode: React.FC<NodeProps<CustomNode['data']>> = ({ id, data, selected }) => {
  const { updateNode, duplicateNode, removeNode } = useCanvasStore();

  const [localStyle, setLocalStyle] = useState(data.style || '');
  const [localLighting, setLocalLighting] = useState(data.lighting || '');
  const [localCamera, setLocalCamera] = useState(data.camera || '');
  const [localEffect, setLocalEffect] = useState(data.effect || '');

  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label || '效果配置');

  // 同步数据到节点
  useEffect(() => {
    updateNode(id, {
      style: localStyle,
      lighting: localLighting,
      camera: localCamera,
      effect: localEffect,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStyle, localLighting, localCamera, localEffect]);

  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditLabel(data.label || '效果配置');
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
      setEditLabel(data.label || '效果配置');
    }
  }, [handleLabelBlur, data.label]);

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
              ✨ {data.label || '效果配置'}
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
              🎨 风格
            </label>
            <Select
              value={localStyle}
              onChange={setLocalStyle}
              style={{ width: '100%' }}
              options={STYLE_OPTIONS}
              popupClassName="nodrag nowheel"
              placeholder="选择风格"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              ☀️ 光影
            </label>
            <Select
              value={localLighting}
              onChange={setLocalLighting}
              style={{ width: '100%' }}
              options={LIGHTING_OPTIONS}
              popupClassName="nodrag nowheel"
              placeholder="选择光影"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              🎬 运镜
            </label>
            <Select
              value={localCamera}
              onChange={setLocalCamera}
              style={{ width: '100%' }}
              options={CAMERA_OPTIONS}
              popupClassName="nodrag nowheel"
              placeholder="选择运镜"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              ✨ 特效
            </label>
            <Select
              value={localEffect}
              onChange={setLocalEffect}
              style={{ width: '100%' }}
              options={EFFECT_OPTIONS}
              popupClassName="nodrag nowheel"
              placeholder="选择特效"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EffectConfigNode;
