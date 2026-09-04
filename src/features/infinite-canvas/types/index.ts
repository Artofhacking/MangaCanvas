import type { NodeChange, EdgeChange, Connection } from 'reactflow';

// Node types
export interface NodeData {
  label: string;
  content?: string;
  url?: string;
  base64?: string;
  loading?: boolean;
  error?: string;
  model?: string;
  size?: string;
  quality?: string;
  ratio?: string;
  duration?: number;
  prompt?: string;
  executed?: boolean;
  outputNodeId?: string;
  autoExecute?: boolean;
  sourceType?: string;
  sourceAssetId?: string;
  sourceLibrary?: string;
  createdAt?: number;
  updatedAt?: number;
  thumbnail?: string;
  [key: string]: unknown;
}

export interface CanvasMaterialItem {
  id: string;
  library: 'materials' | 'subjects';
  category: 'character' | 'scene' | 'object' | 'sound';
  title: string;
  subtitle: string;
  status: string;
  cover?: string;
}

export interface CustomNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: NodeData;
  zIndex?: number;
}

export interface CustomEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  data?: {
    promptOrder?: number;
    imageRole?: string;
    [key: string]: unknown;
  };
}

// Project types
export interface Project {
  id: string;
  name: string;
  thumbnail: string;
  createdAt: Date;
  updatedAt: Date;
  projectId?: string;
  sourceType?: string;
  sourceAssetId?: number;
  canvasData: {
    nodes: CustomNode[];
    edges: CustomEdge[];
    viewport: { x: number; y: number; zoom: number };
  };
}

// Model types
export interface ModelConfig {
  key: string;
  label: string;
  type: 'image' | 'video' | 'chat';
  endpoint?: string;
  async?: boolean;
  qualities?: { label: string; key: string }[];
  ratios?: { label: string; key: string }[];
  resolutions?: { label: string; key: string }[];
  sizes?: { label: string; key: string }[];
  durs?: { label: string; key: number }[];
  defaultParams?: {
    size?: string;
    quality?: string;
    ratio?: string;
    duration?: number;
    resolution?: string;
  };
  getSizesByQuality?: (quality: string) => { label: string; key: string }[];
  tips?: string;
}

export interface SizeOption {
  label: string;
  key: string;
}

export interface QualityOption {
  label: string;
  key: string;
}

// API types
export interface ImageGenerationParams {
  model: string;
  prompt: string;
  size: string;
  quality?: string;
  image?: string;
  images?: string[];  // For image-to-image model
  n?: number;
}

// DashScope API types (for wan2.6-t2i)
export interface DashScopeImageParams {
  model: string;
  input: {
    messages: {
      role: 'user';
      content: {
        text: string;
      }[];
    }[];
  };
  parameters?: {
    prompt_extend?: boolean;
    watermark?: boolean;
    n?: number;
    negative_prompt?: string;
    size?: string;
  };
}

export interface DashScopeSubmitResponse {
  output: {
    task_status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
    task_id: string;
  };
  request_id: string;
}

export interface DashScopeTaskResult {
  request_id: string;
  output: {
    task_id: string;
    task_status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
    submit_time?: string;
    scheduled_time?: string;
    end_time?: string;
    finished?: boolean;
    choices?: {
      finish_reason: string;
      message: {
        role: string;
        content: {
          image?: string;
          type?: string;
        }[];
      };
    }[];
    code?: string;
    message?: string;
  };
  usage?: {
    size?: string;
    total_tokens?: number;
    image_count?: number;
    output_tokens?: number;
    input_tokens?: number;
  };
}

export interface VideoGenerationParams {
  model: string;
  prompt: string;
  first_frame_image?: string;
  last_frame_image?: string;
  size?: string;
  seconds?: number;
  resolution?: string;
  template?: string;  // 视频特效模板
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionParams {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
}

// Store types
export interface ThemeStore {
  isDark: boolean;
  toggleTheme: () => void;
}

export interface ProjectsStore {
  projects: Project[];
  currentProjectId: string | null;
  initProjects: () => void;
  saveProjects: () => void;
  createProject: (name?: string) => string;
  createWorkflowDocument: (workflow: {
    id: string;
    name: string;
    projectId: string;
    sourceType: string;
    sourceAssetId?: number;
  }) => void;
  updateProject: (id: string, data: Partial<Project>) => void;
  getProjectById: (id: string) => Project | null;
  updateProjectCanvas: (id: string, canvasData: Partial<Project['canvasData']>) => void;
  getProjectCanvas: (id: string) => Project['canvasData'] | null;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  duplicateProject: (id: string) => string | null;
}

export interface CanvasStore {
  nodes: CustomNode[];
  edges: CustomEdge[];
  viewport: { x: number; y: number; zoom: number };
  currentProjectId: string | null;
  history: { nodes: CustomNode[]; edges: CustomEdge[] }[];
  historyIndex: number;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (type: string, position?: { x: number; y: number }, data?: Partial<NodeData>) => string;
  updateNode: (id: string, data: Partial<NodeData>) => void;
  removeNode: (id: string) => void;
  duplicateNode: (id: string) => string | null;
  addEdgeManually: (params: Partial<CustomEdge>) => void;
  updateEdge: (id: string, data: Partial<CustomEdge['data']>) => void;
  clearCanvas: () => void;
  loadProject: (projectId: string, getProjectCanvas: (id: string) => Project['canvasData'] | null) => void;
  saveProject: (updateProjectCanvas: (id: string, data: Project['canvasData']) => void) => void;
  updateViewport: (viewport: { x: number; y: number; zoom: number }) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  saveHistory: () => void;
}

// Workflow types
export interface WorkflowParams {
  workflow_type: 'text_to_image' | 'text_to_image_to_video' | 'storyboard' | 'multi_angle_storyboard';
  image_prompt?: string;
  video_prompt?: string;
  character?: {
    name: string;
    description: string;
  };
  shots?: {
    title: string;
    prompt: string;
  }[];
  multi_angle?: {
    character_description: string;
  };
}
