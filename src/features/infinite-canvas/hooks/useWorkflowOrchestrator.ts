/**
 * Workflow Orchestrator Hook
 * 工作流编排器 - AI 驱动的工作流自动编排
 */
import { useState, useCallback } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import { chatService } from '@/api/aigc';
import type { WorkflowParams } from '../types';

// 意图分析系统提示词
const INTENT_ANALYSIS_PROMPT = `你是一个工作流分析助手。根据用户输入判断需要的工作流类型和参数。

支持的工作流类型：
1. text_to_image - 简单文生图（仅需图片提示词）
2. text_to_image_to_video - 文生图再生成视频（需图片提示词和视频提示词）
3. storyboard - 分镜生成（需角色描述和多个镜头）
4. multi_angle_storyboard - 多角度分镜（需角色描述）

请分析用户输入，返回JSON格式：
{
  "workflow_type": "类型",
  "image_prompt": "图片提示词（如果有）",
  "video_prompt": "视频提示词（如果有）",
  "character": {
    "name": "角色名",
    "description": "角色描述"
  },
  "shots": [
    { "title": "镜头标题", "prompt": "镜头提示词" }
  ]
}`;

// 工作流类型
export enum WorkflowType {
  TEXT_TO_IMAGE = 'text_to_image',
  TEXT_TO_IMAGE_TO_VIDEO = 'text_to_image_to_video',
  STORYBOARD = 'storyboard',
  MULTI_ANGLE_STORYBOARD = 'multi_angle_storyboard',
}

interface UseWorkflowOrchestratorReturn {
  executing: boolean;
  progress: number;
  currentStep: string;
  executeWorkflow: (userInput: string, model?: string) => Promise<void>;
  analyzeIntent: (userInput: string, model?: string) => Promise<WorkflowParams | null>;
}

export const useWorkflowOrchestrator = (): UseWorkflowOrchestratorReturn => {
  const [executing, setExecuting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');

  const { addNode, addEdgeManually, saveHistory, nodes } = useCanvasStore();

  /**
   * 分析用户意图
   */
  const analyzeIntent = useCallback(
    async (userInput: string, model = 'qwen-plus'): Promise<WorkflowParams | null> => {
      try {
        const content = await chatService.complete({
          model,
          messages: [
            { role: 'system', content: INTENT_ANALYSIS_PROMPT },
            { role: 'user', content: userInput },
          ],
        });

        if (!content) return null;

        // 提取 JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        const params = JSON.parse(jsonMatch[0]) as WorkflowParams;
        return params;
      } catch (error) {
        console.error('意图分析失败:', error);
        return null;
      }
    },
    []
  );

  /**
   * 等待节点执行完成
   */
  const waitForNodeComplete = useCallback(
    (nodeId: string, timeout = 120000): Promise<string> => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const checkInterval = setInterval(() => {
          const node = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);

          if (node?.data?.executed && node.data?.outputNodeId) {
            clearInterval(checkInterval);
            resolve(node.data.outputNodeId);
          }

          if (Date.now() - startTime > timeout) {
            clearInterval(checkInterval);
            reject(new Error('节点执行超时'));
          }
        }, 500);
      });
    },
    []
  );

  /**
   * 执行文生图工作流
   */
  const executeTextToImage = useCallback(
    async (params: WorkflowParams) => {
      setCurrentStep('创建文生图工作流');
      setProgress(20);

      const startX = Math.max(...nodes.map((n) => n.position.x), 100) + 300;
      const startY = 100;

      // 创建文本节点
      const textNodeId = addNode('text', { x: startX, y: startY }, { content: params.image_prompt || '' });
      setProgress(40);

      // 创建配置节点
      const configNodeId = addNode(
        'imageConfig',
        { x: startX + 400, y: startY },
        {
          model: 'wan2.6-t2i',
          size: '1280*1280',
        }
      );
      setProgress(60);

      // 连接节点
      addEdgeManually({
        source: textNodeId,
        target: configNodeId,
        sourceHandle: 'right',
        targetHandle: 'left',
      });

      setProgress(100);
      saveHistory();
    },
    [addNode, addEdgeManually, saveHistory, nodes]
  );

  /**
   * 执行文生图转视频工作流
   */
  const executeTextToImageToVideo = useCallback(
    async (params: WorkflowParams) => {
      setCurrentStep('创建图生视频工作流');
      setProgress(15);

      const startX = Math.max(...nodes.map((n) => n.position.x), 100) + 300;
      const startY = 100;

      // 文本节点
      const textNodeId = addNode('text', { x: startX, y: startY }, { content: params.image_prompt || '' });
      setProgress(25);

      // 图片配置节点
      const imageConfigId = addNode(
        'imageConfig',
        { x: startX + 400, y: startY },
        {
          model: 'wan2.6-t2i',
          size: '1280*1280',
          autoExecute: true,
        }
      );
      setProgress(35);

      // 连接文本到图片配置
      addEdgeManually({
        source: textNodeId,
        target: imageConfigId,
        sourceHandle: 'right',
        targetHandle: 'left',
      });

      // 等待图片生成完成
      setCurrentStep('等待图片生成');
      try {
        const imageNodeId = await waitForNodeComplete(imageConfigId);
        setProgress(60);

        // 创建视频提示词节点
        const videoTextId = addNode('text', { x: startX, y: startY + 200 }, { content: params.video_prompt || '' });
        setProgress(70);

        // 创建视频配置节点
        const videoConfigId = addNode(
          'videoConfig',
          { x: startX + 800, y: startY + 100 },
          {
            model: 'wan2.6-i2v-flash',
            resolution: '720P',
            duration: 5,
          }
        );
        setProgress(80);

        // 连接图片到视频配置（首帧）
        addEdgeManually({
          source: imageNodeId,
          target: videoConfigId,
          sourceHandle: 'right',
          targetHandle: 'left',
          type: 'imageRole',
          data: { imageRole: 'first_frame_image' },
        });

        // 连接视频提示词
        addEdgeManually({
          source: videoTextId,
          target: videoConfigId,
          sourceHandle: 'right',
          targetHandle: 'left',
          type: 'promptOrder',
          data: { promptOrder: 1 },
        });

        setProgress(100);
        saveHistory();
      } catch (error) {
        console.error('工作流执行失败:', error);
        throw error;
      }
    },
    [addNode, addEdgeManually, saveHistory, waitForNodeComplete, nodes]
  );

  /**
   * 执行分镜工作流
   */
  const executeStoryboard = useCallback(
    async (params: WorkflowParams) => {
      setCurrentStep('创建分镜工作流');
      setProgress(20);

      const startX = Math.max(...nodes.map((n) => n.position.x), 100) + 300;
      const startY = 100;
      const rowSpacing = 250;

      // 创建角色图
      const characterTextId = addNode(
        'text',
        { x: startX, y: startY },
        { content: params.character?.description || '' }
      );

      const characterConfigId = addNode(
        'imageConfig',
        { x: startX + 400, y: startY },
        {
          model: 'wan2.6-t2i',
          size: '1280*1280',
          autoExecute: true,
        }
      );

      addEdgeManually({
        source: characterTextId,
        target: characterConfigId,
        sourceHandle: 'right',
        targetHandle: 'left',
      });

      setProgress(40);

      // 等待角色图生成
      setCurrentStep('等待角色图生成');
      const characterImageId = await waitForNodeComplete(characterConfigId);
      setProgress(50);

      // 创建各个镜头
      const shots = params.shots || [];
      shots.forEach((shot, index) => {
        const shotY = startY + (index + 1) * rowSpacing;

        const shotTextId = addNode('text', { x: startX + 800, y: shotY }, { content: shot.prompt });

        const shotConfigId = addNode(
          'imageConfig',
          { x: startX + 1200, y: shotY },
          {
            model: 'wan2.6-t2i',
            size: '1280*1280',
          }
        );

        // 连接角色图作为参考
        addEdgeManually({
          source: characterImageId,
          target: shotConfigId,
          sourceHandle: 'right',
          targetHandle: 'left',
        });

        // 连接提示词
        addEdgeManually({
          source: shotTextId,
          target: shotConfigId,
          sourceHandle: 'right',
          targetHandle: 'left',
          type: 'promptOrder',
          data: { promptOrder: index + 1 },
        });

        setProgress(50 + ((index + 1) / shots.length) * 50);
      });

      setProgress(100);
      saveHistory();
    },
    [addNode, addEdgeManually, saveHistory, waitForNodeComplete, nodes]
  );

  /**
   * 执行工作流
   */
  const executeWorkflow = useCallback(
    async (userInput: string, model?: string) => {
      try {
        setExecuting(true);
        setProgress(0);
        setCurrentStep('分析意图');

        // 分析意图
        const params = await analyzeIntent(userInput, model);
        if (!params) {
          throw new Error('无法理解用户意图');
        }

        setProgress(10);

        // 根据工作流类型执行
        switch (params.workflow_type) {
          case WorkflowType.TEXT_TO_IMAGE:
            await executeTextToImage(params);
            break;
          case WorkflowType.TEXT_TO_IMAGE_TO_VIDEO:
            await executeTextToImageToVideo(params);
            break;
          case WorkflowType.STORYBOARD:
            await executeStoryboard(params);
            break;
          case WorkflowType.MULTI_ANGLE_STORYBOARD:
            // TODO: 实现多角度分镜
            throw new Error('多角度分镜暂未实现');
          default:
            throw new Error('未知工作流类型');
        }

        setCurrentStep('完成');
      } catch (error) {
        console.error('工作流执行失败:', error);
        throw error;
      } finally {
        setExecuting(false);
      }
    },
    [analyzeIntent, executeTextToImage, executeTextToImageToVideo, executeStoryboard]
  );

  return {
    executing,
    progress,
    currentStep,
    executeWorkflow,
    analyzeIntent,
  };
};

export default useWorkflowOrchestrator;
