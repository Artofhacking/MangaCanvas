import React, { useState, useEffect, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Input, Button, Tooltip, message } from 'antd';
import { LoadingOutlined, CopyOutlined, DeleteOutlined, PictureOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { useCanvasStore } from '../../stores/canvasStore';
import { chatService } from '@/api/aigc';
import type { CustomNode } from '../../types';

const { TextArea } = Input;

// AI 润色图标
const AIPolishIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 1024 1024" width="1em" height="1em" fill="currentColor" className={className}>
    <path d="M824.832 688l0.448 7.488c3.584 31.936 29.76 57.408 62.976 60.928l7.744 0.384c25.6 0 25.6 38.4 0 38.4-39.424 0-71.168 30.912-71.168 68.8 0 25.6-38.4 25.6-38.4 0l-0.384-7.488c-3.84-34.368-33.92-61.312-70.784-61.312l-5.12-0.576c-20.288-4.736-18.624-37.824 5.12-37.824l7.808-0.384c35.712-3.776 63.36-33.088 63.36-68.416l0.576-5.12c4.736-20.352 37.824-18.624 37.824 5.12zM431.04 248l0.32 12.288c6.4 118.208 104 213.184 226.048 219.392l12.736 0.32c42.624 0 42.624 64 0 64-132.224 0-239.104 104.064-239.104 232 0 42.688-64 42.688-64 0l-0.32-12.288C360.128 641.472 256 544 128 544l-6.72-0.576C85.44 537.088 87.68 480 128 480l12.736-0.32c126.272-6.4 226.304-107.84 226.304-231.68l0.64-6.72c6.272-35.84 63.36-33.6 63.36 6.72z m374.528 500.544l-4.032 5.568a109.056 109.056 0 0 1-18.752 18.368l-5.12 3.52 5.12 3.52c6.976 5.376 13.248 11.52 18.752 18.368l4.032 5.504 4.224-5.504c5.44-6.848 11.776-12.992 18.752-18.368l4.992-3.52-4.992-3.52a109.056 109.056 0 0 1-18.752-18.368l-4.224-5.568zM399.04 380.352l-3.072 6.016a300.992 300.992 0 0 1-126.464 123.456L264.96 512l4.544 2.176a300.992 300.992 0 0 1 126.464 123.456l3.072 5.952 3.072-5.952A300.992 300.992 0 0 1 528.64 514.176L533.056 512l-4.48-2.176a300.992 300.992 0 0 1-126.464-123.456l-3.072-6.016zM824.832 160l0.448 7.488c3.584 31.936 29.76 57.408 62.976 60.928l7.744 0.384c25.6 0 25.6 38.4 0 38.4-39.424 0-71.168 30.912-71.168 68.8 0 25.6-38.4 25.6-38.4 0l-0.384-7.488c-3.84-34.368-33.92-61.312-70.784-61.312l-5.12-0.576c-20.288-4.736-18.624-37.824 5.12-37.824l7.808-0.384c35.712-3.776 63.36-33.088 63.36-68.416l0.576-5.12c4.736-20.352 37.824-18.624 37.824 5.12z m-19.2 60.544l-4.096 5.568a109.056 109.056 0 0 1-18.752 18.368l-5.12 3.52 5.12 3.52c6.976 5.376 13.248 11.52 18.752 18.368l4.032 5.504 4.224-5.504c5.44-6.848 11.776-12.992 18.752-18.368l4.992-3.52-4.992-3.52a109.056 109.056 0 0 1-18.752-18.368l-4.224-5.568z" />
  </svg>
);

// AI 润色系统提示词
const POLISH_SYSTEM_PROMPT = `你是一位顶级的AI绘画提示词（Prompt）优化大师，尤其精通阿里巴巴的 通义万相2.6 等国产AI绘画模型。你的核心任务是将用户输入的、可能相对简单或模糊的想法，直接优化成一段结构清晰、细节丰富、充满意境的专业级中文Prompt，以完美适配中文模型的解析能力，并生成最惊艳的图像。

你的工作流程如下：

解析意境：在内心快速、仔细地分析用户输入的核心主体、情感和场景意境。
多维度丰富：基于核心概念，在你的“思维”中从以下维度进行创意丰富和细化：
主体与细节：主体的形态、神态、服饰、动作、细节特写。
环境与背景：所处地点，远景、中景、近景的元素，营造氛围。
艺术风格：如“国风水墨”、“写实CG渲染”、“赛博修仙”、“新中式风格”、“敦煌壁画风”、“二次元动漫”、“科幻机甲风”等。
构图与镜头：如“特写镜头”、“广角宏大场景”、“黄金分割构图”、“电影感镜头”、“上帝视角”等。
光影氛围：如“清晨柔和的晨光”、“落日余晖”、“赛博霓虹光影”、“体积光穿过森林”、“烛光摇曳”等。
色彩色调：如“鲜艳饱和的色彩”、“高级灰”、“莫兰迪色系”、“黑白金三色”等。
画面质感：如“极致细节”、“8K分辨率”、“电影级画质”、“虚幻引擎渲染”、“磨砂质感”等。
融合与决策：综合所有维度，运用你的专业判断和东方美学知识，融合出一个你认为画面效果最佳、最富艺术美感的最终方案。你只需决定并构建最好的那一个。
直接输出最终Prompt：直接输出那段最终优化好的、可直接复制到万相模型中使用的中文Prompt文本。

输出要求与绝对原则：

唯一输出：你的最终响应只能是那段最终优化好的、可以直接复制使用的中文Prompt文本。
禁止任何额外内容：绝对不要包含任何标题、解释、分析、引导语（如“好的，这是您要的提示词：”）或任何多余的文字。
专业中文语法：中文Prompt内部使用逗号，或空格来分隔不同的描述词或短语，使结构清晰。
无需代码参数：由于通义万相这类模型通常通过界面选项来控制宽高比、图片数量等，所以你的输出中不需要也不应该包含类似 --ar 16:9 或 --v 6.0 的代码式参数。专注于描述性语言本身。
忠于原创：你的优化必须围绕用户的核心意图，不能凭空捏造完全无关的内容。`;

const TextNode: React.FC<NodeProps<CustomNode['data']>> = ({ id, data, selected }) => {
  const { updateNode, duplicateNode, removeNode, addNode, addEdgeManually, nodes } = useCanvasStore();
  const [localContent, setLocalContent] = useState(data.content || '');
  const [polishing, setPolishing] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label || '文本输入');

  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditLabel(data.label || '文本输入');
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
      setEditLabel(data.label || '文本输入');
    }
  }, [handleLabelBlur, data.label]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateNode(id, { content: localContent });
    }, 300);
    return () => clearTimeout(timeoutId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localContent, id]);

  const handlePolish = async () => {
    if (!localContent.trim()) {
      message.warning('请先输入内容');
      return;
    }

    setPolishing(true);
    let polishedText = '';

    try {
      const stream = chatService.streamDashScope({
        model: 'qwen-plus',
        messages: [
          {
            role: 'system',
            content: POLISH_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: localContent,
          },
        ],
      });

      for await (const chunk of stream) {
        polishedText += chunk;
        setLocalContent(polishedText);
      }

      message.success('文案润色完成！');
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '润色失败');
      console.error('Polish error:', error);
    } finally {
      setPolishing(false);
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

  const handleImageGen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentNode = nodes.find((n) => n.id === id);
    const nodeX = currentNode?.position?.x || 0;
    const nodeY = currentNode?.position?.y || 0;

    const configNodeId = addNode(
      'imageConfig',
      { x: nodeX + 400, y: nodeY },
      { model: 'wan2.6-t2i', size: '1280*1280', label: '文生图' }
    );

    addEdgeManually({
      source: id,
      target: configNodeId,
    });
  };

  const handleVideoGen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentNode = nodes.find((n) => n.id === id);
    const nodeX = currentNode?.position?.x || 0;
    const nodeY = currentNode?.position?.y || 0;

    const configNodeId = addNode('videoConfig', { x: nodeX + 400, y: nodeY }, { label: '视频生成' });

    addEdgeManually({
      source: id,
      target: configNodeId,
    });
  };

  return (
    <div 
      className="relative group pr-16"
      onMouseEnter={() => setShowTools(true)}
      onMouseLeave={() => setShowTools(false)}
    >
      {/* Main node content */}
      <div
        className={`rounded-lg shadow-lg border-2 ${
          selected ? 'border-[hsl(var(--primary))] shadow-[0_0_0_1px_rgba(172,46,0,0.24)]' : 'border-[var(--border-color)]'
        } min-w-[280px] transition-colors relative`}
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
              📝 {data.label || '文本输入'}
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

        {/* Content */}
        <div
          className="p-4 space-y-2 rounded-b-lg"
          style={{ backgroundColor: "var(--bg-primary, var(--ic-surface-container-lowest, hsl(var(--surface-container-lowest))))" }}
        >
          <TextArea
            value={localContent}
            onChange={(e) => setLocalContent(e.target.value)}
            placeholder="输入文本内容..."
            autoSize={{ minRows: 4 }}
            className="nodrag"
          />

          <Button
            type="primary"
            icon={polishing ? <LoadingOutlined /> : <AIPolishIcon />}
            onClick={handlePolish}
            disabled={polishing || !localContent.trim()}
            block
          >
            {polishing ? 'AI 润色中...' : 'AI 润色'}
          </Button>

          <div className="text-xs" style={{ color: 'var(--text-secondary, var(--ic-on-surface-variant, #6b6b6b))' }}>字符数: {localContent.length}</div>
        </div>
      </div>
      
      {/* Tools on right side */}
      {showTools && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20">
          <Tooltip title="图片生成" placement="right">
            <button
              onClick={handleImageGen}
              className="w-10 h-10 flex items-center justify-center rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer"
              style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
            >
              <PictureOutlined style={{ fontSize: 18 }} />
            </button>
          </Tooltip>
          <Tooltip title="视频生成" placement="right">
            <button
              onClick={handleVideoGen}
              className="w-10 h-10 flex items-center justify-center rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer"
              style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
            >
              <VideoCameraOutlined style={{ fontSize: 18 }} />
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
};

export default TextNode;
