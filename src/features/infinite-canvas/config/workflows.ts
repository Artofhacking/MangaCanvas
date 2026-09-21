/**
 * Workflow Templates Configuration
 * 工作流模板配置
 *
 * Starter templates used by the canvas template panel.
 * Keep this list 漫剧-relevant only. Generic AI-toy demos (CNY pet/dog,
 * couplets, panda, donut, dancing-effect packs, etc.) must not appear here.
 */
import type { CustomNode, CustomEdge } from '../types';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  cover?: string;
  createNodes: (startPosition: { x: number; y: number }) => {
    nodes: Partial<CustomNode>[];
    edges: Partial<CustomEdge>[];
  };
}

// Multi-angle camera prompts
export const CAMERA_ANGLE_PROMPTS = [
  { key: 'forward', label: '前推', prompt: '将镜头向前移动' },
  { key: 'left', label: '左移', prompt: '将镜头向左移动' },
  { key: 'right', label: '右移', prompt: '将镜头向右移动' },
  { key: 'topDown', label: '俯视', prompt: '将镜头转为俯视' },
  { key: 'wideAngle', label: '广角', prompt: '将镜头转为广角镜头' },
  { key: 'closeUp', label: '特写', prompt: '将镜头转为特写镜头' },
  { key: 'rotateLeft', label: '左旋45°', prompt: '镜头向左旋转45度' },
  { key: 'rotateRight', label: '右旋45°', prompt: '镜头向右旋转45度' },
];

/**
 * Empty until a real 漫剧 template pack exists.
 * Prefer a clean empty state over fake general-content demos.
 */
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [];

export const hasStarterWorkflowTemplates = () => WORKFLOW_TEMPLATES.length > 0;
