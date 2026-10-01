import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge as addReactFlowEdge, NodeChange, EdgeChange, Connection, Node, Edge } from 'reactflow';
import type { CustomNode, CustomEdge, NodeData, CanvasStore, Project } from '../types';
import { isGenerateNodeType, nextSlotOrder } from '../utils/generateSlots';
import { stripNodeGenerationTransients } from '../utils/videoJobBinding';

let nodeId = 0;
const getNodeId = () => `node_${nodeId++}`;

type CanvasRemovalApi = {
  nodes: CustomNode[];
  edges: CustomEdge[];
  referencePickTargetId: string | null;
  saveHistory: () => void;
};

/** Shared by context-menu delete and keyboard delete. One history entry per call. */
function commitCanvasRemoval(
  get: () => CanvasRemovalApi,
  set: (partial: Pick<CanvasRemovalApi, 'nodes' | 'edges' | 'referencePickTargetId'>) => void,
  nodeIds: Iterable<string>,
  edgeIds: Iterable<string> = [],
): boolean {
  const idSet = new Set(nodeIds);
  const edgeSet = new Set(edgeIds);
  if (idSet.size === 0 && edgeSet.size === 0) return false;

  const current = get();
  const pick = current.referencePickTargetId;
  const nodes = current.nodes.filter((node) => !idSet.has(node.id));
  const edges = current.edges.filter(
    (edge) => !idSet.has(edge.source) && !idSet.has(edge.target) && !edgeSet.has(edge.id),
  );
  const referencePickTargetId = pick && idSet.has(pick) ? null : pick;
  if (
    nodes.length === current.nodes.length &&
    edges.length === current.edges.length &&
    referencePickTargetId === pick
  ) {
    return false;
  }

  set({ nodes, edges, referencePickTargetId });
  get().saveHistory();
  return true;
}

const getDefaultNodeData = (type: string): NodeData => {
  switch (type) {
    case 'text':
      return { content: '', label: '文本' };
    case 'imageConfig':
      return {
        prompt: '',
        model: 'gpt-image-2',
        size: '1024x1024',
        quality: 'medium',
        ratio: '1:1',
        n: 1,
        label: '画面节点',
      };
    case 'image':
      return { url: '', label: '图片节点' };
    case 'videoConfig':
      return {
        prompt: '',
        model: 'happyhorse-1.1-t2v',
        size: '1280*720',
        resolution: '720P',
        ratio: '16:9',
        duration: 5,
        n: 1,
        label: '视频节点',
      };
    case 'video':
      return { url: '', label: '视频节点' };
    case 'audio':
      return {
        prompt: '',
        url: '',
        model: '',
        audioMode: 'tts',
        label: '音频',
      };
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
  referencePickTargetId: null,
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
    const nodes = JSON.parse(JSON.stringify(state.nodes)) as CustomNode[];
    const pick = get().referencePickTargetId;

    set({
      nodes,
      edges: JSON.parse(JSON.stringify(state.edges)),
      historyIndex: newIndex,
      referencePickTargetId: pick && nodes.some((node) => node.id === pick && isGenerateNodeType(node.type)) ? pick : null,
    });
  },

  // Redo
  redo: () => {
    const { historyIndex, history } = get();
    if (historyIndex >= history.length - 1) return;

    const newIndex = historyIndex + 1;
    const state = history[newIndex];
    const nodes = JSON.parse(JSON.stringify(state.nodes)) as CustomNode[];
    const pick = get().referencePickTargetId;

    set({
      nodes,
      edges: JSON.parse(JSON.stringify(state.edges)),
      historyIndex: newIndex,
      referencePickTargetId: pick && nodes.some((node) => node.id === pick && isGenerateNodeType(node.type)) ? pick : null,
    });
  },

  // Check if can undo
  canUndo: () => get().historyIndex > 0,

  // Check if can redo
  canRedo: () => get().historyIndex < get().history.length - 1,

  // Node operations
  onNodesChange: (changes: NodeChange[]) => {
    const current = get().nodes as unknown as Node[];
    const nextChanges = changes.filter((change) => {
      if (change.type !== 'dimensions' || !change.dimensions) return true;
      const node = current.find((item) => item.id === change.id);
      if (!node) return true;
      return node.width !== change.dimensions.width || node.height !== change.dimensions.height;
    });
    if (nextChanges.length === 0) return;
    set({
      nodes: applyNodeChanges(nextChanges, current) as unknown as CustomNode[],
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
    let edgeData: NonNullable<CustomEdge['data']> = {};

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

    if (connection.target && isGenerateNodeType(targetNode?.type)) {
      const slotOrder = nextSlotOrder(connection.target, get().edges);
      edgeData = { ...edgeData, slotOrder };
      if (edgeType === 'promptOrder' && !('promptOrder' in edgeData)) {
        edgeData = { ...edgeData, promptOrder: slotOrder };
      }
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
    const node = get().nodes.find((item) => item.id === id);
    if (!node) return;
    const unchanged = Object.entries(data).every(([key, value]) => node.data[key] === value);
    if (unchanged) return;
    set({
      nodes: get().nodes.map((item) =>
        item.id === id ? { ...item, data: { ...item.data, ...data } } : item
      ),
    });
  },

  // Remove node (context menu / toolbar). Same graph update as keyboard delete.
  removeNode: (id: string) => {
    commitCanvasRemoval(get, set, [id]);
  },

  removeSelectedNodes: () => {
    const { nodes, edges } = get();
    return commitCanvasRemoval(
      get,
      set,
      nodes.filter((node) => node.selected).map((node) => node.id),
      edges.filter((edge) => edge.selected).map((edge) => edge.id),
    );
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
    const stripped = stripNodeGenerationTransients(newNode);
    const data = { ...stripped.data };
    delete data.videoJobIds;
    newNode.data = {
      ...data,
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

  selectNode: (id: string) => {
    set({
      nodes: get().nodes.map((node) => ({
        ...node,
        selected: node.id === id,
      })),
    });
  },

  setReferencePickTarget: (id: string | null) => {
    if (!id) {
      if (get().referencePickTargetId !== null) set({ referencePickTargetId: null });
      return;
    }
    const node = get().nodes.find((item) => item.id === id);
    if (!node || !isGenerateNodeType(node.type)) {
      if (get().referencePickTargetId !== null) set({ referencePickTargetId: null });
      return;
    }
    if (!node.selected) get().selectNode(id);
    if (get().referencePickTargetId !== id) set({ referencePickTargetId: id });
  },

  // Add edge
  addEdgeManually: (params: Partial<CustomEdge>) => {
    // Determine edge type based on source and target node types
    const sourceNode = get().nodes.find(n => n.id === params.source);
    const targetNode = get().nodes.find(n => n.id === params.target);

    let edgeType = params.type;
    let edgeData: NonNullable<CustomEdge['data']> = params.data || {};

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

    if (params.target && isGenerateNodeType(targetNode?.type) && edgeData.slotOrder == null) {
      edgeData = { ...edgeData, slotOrder: nextSlotOrder(params.target, get().edges) };
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
    set({ nodes: [], edges: [], viewport: { x: 100, y: 50, zoom: 0.8 }, referencePickTargetId: null });
    nodeId = 0;
  },

  // Load project
  loadProject: (projectId: string, getProjectCanvas: (id: string) => Project['canvasData'] | null) => {
    set({ currentProjectId: projectId });
    const canvasData = getProjectCanvas(projectId);

    if (canvasData) {
      const nodes = (canvasData.nodes || []).map((node) => stripNodeGenerationTransients(node));
      set({
        nodes,
        edges: canvasData.edges || [],
        viewport: canvasData.viewport || { x: 100, y: 50, zoom: 0.8 },
        referencePickTargetId: null,
      });

      // Update node ID counter
      const maxId = nodes.reduce((max: number, node: CustomNode) => {
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
          nodes: JSON.parse(JSON.stringify(nodes)),
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
    const current = get().viewport;
    if (current.x === newViewport.x && current.y === newViewport.y && current.zoom === newViewport.zoom) return;
    set({ viewport: newViewport });
  },
}));
