import type { NodeChange, EdgeChange, Connection } from 'reactflow';

// Node types
export interface NodeData {
  label: string;
  content?: string;
  url?: string;
  /**
   * Every image from one generation, in return order.
   * Set only when there is more than one. `url` is the front image.
   */
  imageUrls?: string[];
  /** Index of the front image in `imageUrls`. Kept in sync with `url`. */
  activeImageIndex?: number;
  /**
   * Every video from one generation, in return order.
   * Set only when there is more than one. `url` is the front clip.
   */
  videoUrls?: string[];
  /** Stills lined up with `videoUrls`. Used as the corner cards. */
  thumbnailUrls?: string[];
  /** Index of the front clip in `videoUrls`. Kept in sync with `url`. */
  activeVideoIndex?: number;
  base64?: string;
  loading?: boolean;
  /** Real 0–100 generation percent when the pipeline reports one. */
  progress?: number;
  /** Short generation phase shown on the media chip, e.g. 排队中 / 生成中. */
  statusLabel?: string;
  /**
   * Server video job ids for this node. Persisted with the canvas so a reload can resume polling.
   * Cleared when every job reaches a terminal state.
   */
  videoJobIds?: string[];
  error?: string;
  model?: string;
  size?: string;
  quality?: string;
  ratio?: string;
  resolution?: string;
  duration?: number;
  n?: number;
  prompt?: string;
  /** 配音 tts / 音效 sfx / 音乐 music. One audio card owns config and playback. */
  audioMode?: 'tts' | 'sfx' | 'music';
  /** MiniMax TTS voice id from the live audio catalog. */
  voiceId?: string;
  executed?: boolean;
  outputNodeId?: string;
  autoExecute?: boolean;
  sourceType?: string;
  sourceAssetId?: string;
  sourceLibrary?: string;
  createdAt?: number;
  updatedAt?: number;
  thumbnail?: string;
  /** Decoded pixel size. Sizes the card and the resolution badge. */
  width?: number;
  height?: number;
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
  video?: string;
  prompt?: string;
  mediaType?: string;
  hasImage?: boolean;
  hasVideo?: boolean;
}

export interface CustomNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: NodeData;
  zIndex?: number;
  /** React Flow selection flag. Kept on the node so the generate bar can stay mounted. */
  selected?: boolean;
}

export interface CustomEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  /** React Flow selection flag. Keyboard delete removes selected edges with selected nodes. */
  selected?: boolean;
  data?: {
    promptOrder?: number;
    slotOrder?: number;
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
  /** From the list API. Undefined means unknown — do not read it as zero nodes. */
  nodeCount?: number;
  edgeCount?: number;
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
  type: 'image' | 'video' | 'chat' | 'audio';
  /** Live audio catalog: tts = 配音, music = 音乐. SFX is not a MiniMax model. */
  task?: 'tts' | 'music';
  voices?: { label: string; key: string }[];
  enabled?: boolean;
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
    n?: number;
    voiceId?: string;
  };
  maxN?: number;
  supportsAspect?: boolean;
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
  signal?: AbortSignal;
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
  images?: string[];
  imageNames?: string[];
  size?: string;
  seconds?: number;
  resolution?: string;
  /** Sent for HappyHorse t2v / r2v. Absent when the clip follows the first frame. */
  ratio?: string;
  template?: string;  // 视频特效模板
  nodeId?: string;
  /** Shared by the N jobs of one stacked generation so they do not cancel each other. */
  batchId?: string;
  /** Skip the per-clip toast. The caller reports one result for the whole batch. */
  quiet?: boolean;
  signal?: AbortSignal;
  /** Fired once the server has accepted the job, before polling finishes. */
  onSubmitted?: (jobId: string) => void;
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
    canvasData?: Project['canvasData'];
  }) => void;
  syncProjectWorkflows: (projectId: string, keepWorkflowId?: string | null) => Promise<void>;
  reassignWorkflowDocument: (previousId: string, next: {
    id: string;
    name: string;
    projectId: string;
    sourceType: string;
    sourceAssetId?: number;
    canvasData: Project['canvasData'];
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
  /** Generate node currently accepting canvas clicks as reference edges. Null leaves drag-connect unchanged. */
  referencePickTargetId: string | null;
  setReferencePickTarget: (id: string | null) => void;
  addNode: (type: string, position?: { x: number; y: number }, data?: Partial<NodeData>) => string;
  updateNode: (id: string, data: Partial<NodeData>) => void;
  removeNode: (id: string) => void;
  /** Selected nodes, edges that touch them, and any selected edges. One history step. */
  removeSelectedNodes: () => boolean;
  duplicateNode: (id: string) => string | null;
  selectNode: (id: string) => void;
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
