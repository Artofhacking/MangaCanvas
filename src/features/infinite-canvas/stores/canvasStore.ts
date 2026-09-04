import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge as addReactFlowEdge, NodeChange, EdgeChange, Connection, Node, Edge } from 'reactflow';
import type { CustomNode, CustomEdge, NodeData, CanvasStore, Project } from '../types';

let nodeId = 0;
const getNodeId = () => `node_${nodeId++}`;

const getDefaultNodeData = (type: string): NodeData => {
  switch (type) {
    case 'text':
      return { content: '', label: '文本输入' };
    case 'imageConfig':
      return {
        prompt: '',
        model: 'wan2.6-t2i',
        size: '1280*1280',
        quality: 'standard',
        label: '文生图',
      };
    case 'image':
      return { url: '', label: '图片节点' };
    case 'videoConfig':
      return {
        prompt: '',
        model: 'wan2.6-t2v',
        size: '1280*720',
        duration: 5,
        label: '视频生成',
      };
    case 'video':
      return { url: '', label: '视频节点' };
    case 'effectConfig':
      return {
        style: '',
        lighting: '',
        camera: '',
        effect: '',
        label: '视频特效',
      };
    default:
      return { label: '视频特效' };
  }
};

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: [],
  edges: [],
  viewport: { x: 100, y: 50, zoom: 0.8 },
  currentProjectId: null,
  history: [],
  historyIndex: -1,

  // Save current state to history
  saveHistory: () => {
    const state = {
      nodes: JSON.parse(JSON.stringify(get().nodes)),
      edges: JSON.parse(JSON.stringify(get().edges)),
    };

    const { history, historyIndex } = get();

    // Remove future history if not at the end
    if (historyIndex < history.length - 1) {
      set({ history: history.slice(0, historyIndex + 1) });
    }

    // Add new state
    const newHistory = [...get().history, state];

    // Limit history size to 50
    if (newHistory.length > 50) {
      newHistory.shift();
      set({ history: newHistory, historyIndex: 49 });
    } else {
      set({ history: newHistory, historyIndex: newHistory.length - 1 });
    }
  },

  // Undo
  undo: () => {
    const { historyIndex, history } = get();
    if (historyIndex <= 0) return;

    const newIndex = historyIndex - 1;
    const state = history[newIndex];

    set({
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      edges: JSON.parse(JSON.stringify(state.edges)),
      historyIndex: newIndex,
    });
  },

  // Redo
  redo: () => {
    const { historyIndex, history } = get();
    if (historyIndex >= history.length - 1) return;

    const newIndex = historyIndex + 1;
    const state = history[newIndex];

    set({
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      edges: JSON.parse(JSON.stringify(state.edges)),
      historyIndex: newIndex,
    });
  },

  // Check if can undo
  canUndo: () => get().historyIndex > 0,

  // Check if can redo
  canRedo: () => get().historyIndex < get().history.length - 1,

  // Node operations
  onNodesChange: (changes: NodeChange[]) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes as unknown as Node[]) as unknown as CustomNode[],
    });
  },

  // Edge operations
  onEdgesChange: (changes: EdgeChange[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges as unknown as Edge[]) as unknown as CustomEdge[],
    });
  },

  onConnect: (connection: Connection) => {
    // Check connection types and set edge type accordingly
    const sourceNode = get().nodes.find(n => n.id === connection.source);
    const targetNode = get().nodes.find(n => n.id === connection.target);

    let edgeType = undefined;
    let edgeData = {};

    if (sourceNode?.type === 'image' && targetNode?.type === 'videoConfig') {
      // Use imageRole edge type
      edgeType = 'imageRole';
      edgeData = { imageRole: 'first_frame_image' };
    } else if (sourceNode?.type === 'text' && targetNode?.type === 'imageConfig') {
      // Use promptOrder edge type
      const existingTextEdges = get().edges.filter(
        (e) => e.target === connection.target && e.type === 'promptOrder'
      );
      const nextOrder = existingTextEdges.length + 1;
      edgeType = 'promptOrder';
      edgeData = { promptOrder: nextOrder };
    }

    set({
      edges: addReactFlowEdge(
        { ...connection, type: edgeType, data: edgeData },
        get().edges as unknown as Edge[]
      ) as unknown as CustomEdge[],
    });
    get().saveHistory();
  },

  // Add node
  addNode: (type: string, position = { x: 100, y: 100 }, data: Partial<NodeData> = {}) => {
    const id = getNodeId();
    const now = Date.now();
    const newNode: CustomNode = {
      id,
      type,
      position,
      data: {
        ...getDefaultNodeData(type),
        ...data,
        createdAt: data.createdAt || now,
        updatedAt: data.updatedAt || now,
      },
    };
    set({ nodes: [...get().nodes, newNode] });
    get().saveHistory();
    return id;
  },

  // Update node
  updateNode: (id: string, data: Partial<NodeData>) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node
      ),
    });
  },

  // Remove node
  removeNode: (id: string) => {
    set({
      nodes: get().nodes.filter((node) => node.id !== id),
      edges: get().edges.filter((edge) => edge.source !== id && edge.target !== id),
    });
    get().saveHistory();
  },

  // Duplicate node
  duplicateNode: (id: string) => {
    const node = get().nodes.find((n) => n.id === id);
    if (!node) return null;

    const newId = getNodeId();
    const now = Date.now();
    // Deep clone to avoid reference issues
    const newNode: CustomNode = JSON.parse(JSON.stringify(node));
    newNode.id = newId;
    newNode.position = { x: node.position.x + 100, y: node.position.y + 100 };
    (newNode as unknown as Node).selected = true; // Select the new node
    newNode.data = {
      ...newNode.data,
      createdAt: now,
      updatedAt: now,
    };
    // Deselect original node, add new node as selected
    set({ 
      nodes: [
        ...get().nodes.map(n => n.id === id ? { ...n, selected: false } : n),
        newNode
      ] 
    });
    get().saveHistory();
    return newId;
  },

  // Add edge
  addEdgeManually: (params: Partial<CustomEdge>) => {
    // Determine edge type based on source and target node types
    const sourceNode = get().nodes.find(n => n.id === params.source);
    const targetNode = get().nodes.find(n => n.id === params.target);

    let edgeType = params.type;
    let edgeData = params.data || {};

    if (!edgeType) {
      if (sourceNode?.type === 'image' && targetNode?.type === 'videoConfig') {
        edgeType = 'imageRole';
        edgeData = { imageRole: 'first_frame_image', ...edgeData };
      } else if (sourceNode?.type === 'text' && targetNode?.type === 'imageConfig') {
        edgeType = 'promptOrder';
        const existingTextEdges = get().edges.filter(
          (e) => e.target === params.target && e.type === 'promptOrder'
        );
        const nextOrder = existingTextEdges.length + 1;
        edgeData = { promptOrder: nextOrder, ...edgeData };
      }
    }

    const newEdge: CustomEdge = {
      id: `edge_${params.source}_${params.target}`,
      source: params.source!,
      target: params.target!,
      type: edgeType,
      data: edgeData,
      ...params,
    };
    set({ edges: [...get().edges, newEdge] });
    get().saveHistory();
  },

  // Update edge data
  updateEdge: (id: string, data: Partial<CustomEdge['data']>) => {
    set({
      edges: get().edges.map((edge) =>
        edge.id === id ? { ...edge, data: { ...edge.data, ...data } } : edge
      ),
    });
  },

  // Clear canvas
  clearCanvas: () => {
    set({ nodes: [], edges: [], viewport: { x: 100, y: 50, zoom: 0.8 } });
    nodeId = 0;
  },

  // Load project
  loadProject: (projectId: string, getProjectCanvas: (id: string) => Project['canvasData'] | null) => {
    set({ currentProjectId: projectId });
    const canvasData = getProjectCanvas(projectId);

    if (canvasData) {
      set({
        nodes: canvasData.nodes || [],
        edges: canvasData.edges || [],
        viewport: canvasData.viewport || { x: 100, y: 50, zoom: 0.8 },
      });

      // Update node ID counter
      const maxId = (canvasData.nodes || []).reduce((max: number, node: CustomNode) => {
        const match = node.id.match(/node_(\d+)/);
        if (match) {
          return Math.max(max, parseInt(match[1], 10));
        }
        return max;
      }, -1);
      nodeId = maxId + 1;

      // Initialize history
      set({
        history: [{
          nodes: JSON.parse(JSON.stringify(canvasData.nodes || [])),
          edges: JSON.parse(JSON.stringify(canvasData.edges || [])),
        }],
        historyIndex: 0,
      });
    } else {
      get().clearCanvas();
    }
  },

  // Save project
  saveProject: (updateProjectCanvas: (id: string, data: Project['canvasData']) => void) => {
    const { currentProjectId, nodes, edges, viewport } = get();
    if (!currentProjectId) return;
    updateProjectCanvas(currentProjectId, { nodes, edges, viewport });
  },

  // Update viewport
  updateViewport: (newViewport: { x: number; y: number; zoom: number }) => {
    set({ viewport: newViewport });
  },
}));
