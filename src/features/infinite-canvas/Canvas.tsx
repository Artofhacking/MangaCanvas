import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, { Background, MiniMap, useReactFlow, ReactFlowProvider, SelectionMode, Node as RFNode } from 'reactflow';
import {
  ArrowLeftOutlined,
  DownOutlined,
  PlusOutlined,
  AppstoreOutlined,
  DeploymentUnitOutlined,
  UndoOutlined,
  RedoOutlined,
  AimOutlined,
  MinusOutlined,
  FileTextOutlined,
  PictureOutlined,
  BgColorsOutlined,
  VideoCameraOutlined,
  LockOutlined,
  UnlockOutlined,
  DeleteOutlined,
  DownloadOutlined,
  SettingOutlined,
  DragOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  VerticalAlignTopOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignMiddleOutlined,
  AlignCenterOutlined,
  SplitCellsOutlined,
} from '@ant-design/icons';
import { message, Modal, Tooltip } from 'antd';
import 'reactflow/dist/style.css';

import { useCanvasStore } from './stores/canvasStore';
import { useCanvasDocumentsStore } from './stores/projectsStore';
import { useThemeStore } from './stores/themeStore';
import { getAllProjects } from './utils/indexedDB';

import TextNode from './components/nodes/TextNode';
import ImageNode from './components/nodes/ImageNode';
import ImageConfigNode from './components/nodes/ImageConfigNode';
import VideoNode from './components/nodes/VideoNode';
import VideoConfigNode from './components/nodes/VideoConfigNode';
import EffectConfigNode from './components/nodes/EffectConfigNode';
import TemplateEffectNode from './components/nodes/TemplateEffectNode';
import PromptOrderEdge from './components/edges/PromptOrderEdge';
import ImageRoleEdge from './components/edges/ImageRoleEdge';
import ApiSettings from './components/ApiSettings';
import WorkflowPanel from './components/WorkflowPanel';
import MaterialPanel, { MATERIAL_DRAG_MIME } from './components/MaterialPanel';
import type { CanvasMaterialItem } from './types';

const nodeTypes = {
  text: TextNode,
  image: ImageNode,
  imageConfig: ImageConfigNode,
  video: VideoNode,
  videoConfig: VideoConfigNode,
  effectConfig: EffectConfigNode,
  templateEffect: TemplateEffectNode,
};

const edgeTypes = {
  promptOrder: PromptOrderEdge,
  imageRole: ImageRoleEdge,
};

const CanvasInner: React.FC = () => {
  const { projectId, workflowId, episodeId } = useParams<{
    projectId: string;
    workflowId?: string;
    episodeId?: string;
  }>();
  const navigate = useNavigate();
  const { zoomIn, zoomOut, fitView, screenToFlowPosition } = useReactFlow();
  const canvasDocumentId = workflowId || (projectId && episodeId ? `episode-${projectId}-${episodeId}` : undefined);

  const {
    nodes,
    edges,
    viewport,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    loadProject,
    saveProject,
    updateViewport,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useCanvasStore();

  const { projects, getProjectById, getProjectCanvas, updateProjectCanvas, initProjects } = useCanvasDocumentsStore();
  const { isDark } = useThemeStore();

  const [showApiSettings, setShowApiSettings] = useState(false);
  const [showWorkflowPanel, setShowWorkflowPanel] = useState(false);
  const [showMaterialPanel, setShowMaterialPanel] = useState(false);
  const [showNodeMenu, setShowNodeMenu] = useState(false);
  const showGrid = true;
  const [isLocked, setIsLocked] = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [isCanvasMaterialDragOver, setIsCanvasMaterialDragOver] = useState(false);

  const currentWorkflow = canvasDocumentId ? getProjectById(canvasDocumentId) : null;
  const workflowName =
    currentWorkflow?.name ||
    (workflowId ? `工作流 ${workflowId.slice(-6)}` : `片段工作流 ${episodeId || ''}`);
  const workflowContextLabel =
    currentWorkflow?.sourceType === 'scene'
      ? '场景工作流'
      : currentWorkflow?.sourceType === 'character'
      ? '角色工作流'
      : currentWorkflow?.sourceType === 'object'
      ? '物品工作流'
      : currentWorkflow?.sourceType === 'episode'
      ? '片段工作流'
      : '项目工作流'

  const backTarget = useMemo(() => {
    if (!projectId) {
      return { label: '返回项目', action: () => navigate('/projects') };
    }

    if (currentWorkflow?.sourceType === 'episode' && currentWorkflow.sourceAssetId) {
      return {
        label: '返回片段',
        action: () => navigate(`/project/${projectId}/episode/${currentWorkflow.sourceAssetId}`),
      };
    }

    if (currentWorkflow?.sourceType === 'scene') {
      return {
        label: '返回场景',
        action: () => navigate(`/project/${projectId}/scenes`),
      };
    }

    if (currentWorkflow?.sourceType === 'character') {
      return {
        label: '返回角色',
        action: () => navigate(`/project/${projectId}/characters`),
      };
    }

    if (currentWorkflow?.sourceType === 'object') {
      return {
        label: '返回物品',
        action: () => navigate(`/project/${projectId}/objects`),
      };
    }

    return {
      label: '返回项目',
      action: () => navigate(`/project/${projectId}/scenes`),
    };
  }, [currentWorkflow?.sourceAssetId, currentWorkflow?.sourceType, navigate, projectId]);

  const cleanupCanvasTransientUi = useCallback(() => {
    setShowApiSettings(false);
    setShowWorkflowPanel(false);
    setShowMaterialPanel(false);
    setShowNodeMenu(false);
    setShowProjectMenu(false);
    setIsCanvasMaterialDragOver(false);

    Modal.destroyAll();
    message.destroy();

    if (typeof document !== 'undefined') {
      document.body.style.removeProperty('pointer-events');
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('padding-right');
      document.documentElement.style.removeProperty('overflow');
      document.documentElement.style.removeProperty('padding-right');
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupCanvasTransientUi();
    };
  }, [cleanupCanvasTransientUi]);

  const handleBackNavigation = useCallback(() => {
    cleanupCanvasTransientUi();
    backTarget.action();
  }, [backTarget, cleanupCanvasTransientUi]);

  // 直接从 nodes 中计算选中的节点
  const selectedNodes = useMemo(() => {
    return nodes.filter(n => (n as unknown as RFNode).selected).map(n => n.id);
  }, [nodes]);

  // 获取选中的节点数据
  const selectedNodesData = useMemo(() => {
    return nodes.filter(n => (n as unknown as RFNode).selected);
  }, [nodes]);

  // 对齐功能
  const alignNodes = useCallback((alignment: 'left' | 'right' | 'top' | 'bottom' | 'horizontal-center' | 'vertical-center') => {
    if (selectedNodesData.length < 2) return;

    const positions = selectedNodesData.map(n => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
      width: (n as unknown as RFNode & { measured?: { width?: number; height?: number } }).width || (n as unknown as RFNode & { measured?: { width?: number; height?: number } }).measured?.width || 280,
      height: (n as unknown as RFNode & { measured?: { width?: number; height?: number } }).height || (n as unknown as RFNode & { measured?: { width?: number; height?: number } }).measured?.height || 200,
    }));

    let newPositions: { id: string; x: number; y: number }[] = [];

    switch (alignment) {
      case 'left': {
        const minX = Math.min(...positions.map(p => p.x));
        newPositions = positions.map(p => ({ id: p.id, x: minX, y: p.y }));
        break;
      }
      case 'right': {
        const maxRight = Math.max(...positions.map(p => p.x + p.width));
        newPositions = positions.map(p => ({ id: p.id, x: maxRight - p.width, y: p.y }));
        break;
      }
      case 'top': {
        const minY = Math.min(...positions.map(p => p.y));
        newPositions = positions.map(p => ({ id: p.id, x: p.x, y: minY }));
        break;
      }
      case 'bottom': {
        const maxBottom = Math.max(...positions.map(p => p.y + p.height));
        newPositions = positions.map(p => ({ id: p.id, x: p.x, y: maxBottom - p.height }));
        break;
      }
      case 'horizontal-center': {
        const centerY = positions.reduce((sum, p) => sum + p.y + p.height / 2, 0) / positions.length;
        newPositions = positions.map(p => ({ id: p.id, x: p.x, y: centerY - p.height / 2 }));
        break;
      }
      case 'vertical-center': {
        const centerX = positions.reduce((sum, p) => sum + p.x + p.width / 2, 0) / positions.length;
        newPositions = positions.map(p => ({ id: p.id, x: centerX - p.width / 2, y: p.y }));
        break;
      }
    }

    // 更新节点位置
    const updatedNodes = nodes.map(node => {
      const newPos = newPositions.find(p => p.id === node.id);
      if (newPos) {
        return { ...node, position: { x: newPos.x, y: newPos.y } };
      }
      return node;
    });

    useCanvasStore.setState({ nodes: updatedNodes });
    useCanvasStore.getState().saveHistory();
    message.success('节点已对齐');
  }, [selectedNodesData, nodes]);

  // 智能自动对齐并铺开：根据连线关系按执行顺序排列
  const autoAlignNodes = useCallback(() => {
    if (selectedNodesData.length < 2) return;

    const selectedIds = new Set(selectedNodesData.map(n => n.id));
    
    // 获取选中节点之间的连线
    const relevantEdges = edges.filter(
      e => selectedIds.has(e.source) && selectedIds.has(e.target)
    );

    // 拓扑排序：按执行顺序排列节点
    const inDegree: Record<string, number> = {};
    const outEdges: Record<string, string[]> = {};
    
    selectedNodesData.forEach(n => {
      inDegree[n.id] = 0;
      outEdges[n.id] = [];
    });
    
    relevantEdges.forEach(e => {
      inDegree[e.target] = (inDegree[e.target] || 0) + 1;
      outEdges[e.source] = outEdges[e.source] || [];
      outEdges[e.source].push(e.target);
    });

    // BFS 拓扑排序
    const sorted: string[] = [];
    const queue = Object.keys(inDegree).filter(id => inDegree[id] === 0);
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      sorted.push(nodeId);
      (outEdges[nodeId] || []).forEach(targetId => {
        inDegree[targetId]--;
        if (inDegree[targetId] === 0) {
          queue.push(targetId);
        }
      });
    }

    // 如果有节点未被排序（无连线或循环），追加到末尾
    selectedNodesData.forEach(n => {
      if (!sorted.includes(n.id)) {
        sorted.push(n.id);
      }
    });

    const positions = selectedNodesData.map(n => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
      width: (n as unknown as RFNode & { measured?: { width?: number; height?: number } }).width || (n as unknown as RFNode & { measured?: { width?: number; height?: number } }).measured?.width || 280,
      height: (n as unknown as RFNode & { measured?: { width?: number; height?: number } }).height || (n as unknown as RFNode & { measured?: { width?: number; height?: number } }).measured?.height || 200,
    }));

    // 计算节点的水平和垂直范围
    const xRange = Math.max(...positions.map(p => p.x)) - Math.min(...positions.map(p => p.x));
    const yRange = Math.max(...positions.map(p => p.y)) - Math.min(...positions.map(p => p.y));

    let newPositions: { id: string; x: number; y: number }[] = [];
    const gap = 40; // 节点间距

    // 按拓扑顺序排列节点
    const sortedPositions = sorted.map(id => positions.find(p => p.id === id)!);

    if (xRange >= yRange) {
      // 横向排列 -> 水平铺开，Y坐标对齐
      const avgY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;
      const startX = Math.min(...positions.map(p => p.x));
      let currentX = startX;
      newPositions = sortedPositions.map((p) => {
        const pos = { id: p.id, x: currentX, y: avgY };
        currentX += p.width + gap;
        return pos;
      });
    } else {
      // 纵向排列 -> 垂直铺开，X坐标对齐
      const avgX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
      const startY = Math.min(...positions.map(p => p.y));
      let currentY = startY;
      newPositions = sortedPositions.map((p) => {
        const pos = { id: p.id, x: avgX, y: currentY };
        currentY += p.height + gap;
        return pos;
      });
    }

    const updatedNodes = nodes.map(node => {
      const newPos = newPositions.find(p => p.id === node.id);
      if (newPos) {
        return { ...node, position: { x: newPos.x, y: newPos.y } };
      }
      return node;
    });

    useCanvasStore.setState({ nodes: updatedNodes });
    useCanvasStore.getState().saveHistory();
    message.success('节点已按执行顺序对齐');
  }, [selectedNodesData, nodes, edges]);

  // 监听双击事件实现自动对齐
  useEffect(() => {
    const handleDoubleClick = (e: MouseEvent) => {
      // 检查是否点击在选区上
      const target = e.target as HTMLElement;
      if (target.closest('.react-flow__nodesselection') || 
          target.closest('.react-flow__selection')) {
        if (selectedNodes.length >= 2) {
          autoAlignNodes();
        }
      }
    };

    document.addEventListener('dblclick', handleDoubleClick);
    return () => document.removeEventListener('dblclick', handleDoubleClick);
  }, [selectedNodes.length, autoAlignNodes]);

  // 快捷键对齐：A 键自动对齐
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 排除输入框
      if ((e.target as HTMLElement).tagName === 'INPUT' || 
          (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }
      
      if (e.key.toLowerCase() === 'a' && selectedNodes.length >= 2) {
        e.preventDefault();
        autoAlignNodes();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodes.length, autoAlignNodes]);

  // 判断是否允许在页面配置 API Key（仅 HTTPS 或开发模式）
  const allowApiKeyConfig = import.meta.env.DEV || window.location.protocol === 'https:';

  // 粘贴图片或图片链接创建图片节点
  useEffect(() => {
    const isImageUrl = (text: string): boolean => {
      const trimmed = text.trim();
      // 检查是否是图片URL
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        return false;
      }
      // 常见图片后缀
      const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico)(\?.*)?$/i;
      if (imageExtensions.test(trimmed)) {
        return true;
      }
      // 常见图床/CDN模式
      const imageCdnPatterns = [
        /\/image\//i,
        /\/img\//i,
        /\/photos?\//i,
        /\/pictures?\//i,
        /images?\./i,
        /cdn.*\.(jpg|jpeg|png|gif|webp)/i,
        /oss.*aliyuncs\.com/i,
        /cos.*myqcloud\.com/i,
      ];
      return imageCdnPatterns.some(pattern => pattern.test(trimmed));
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (isLocked) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;

      // 先检查是否有图片文件
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;

          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            const viewportCenterX = -viewport.x / viewport.zoom + (window.innerWidth / 2) / viewport.zoom;
            const viewportCenterY = -viewport.y / viewport.zoom + (window.innerHeight / 2) / viewport.zoom;
            
            addNode('image', 
              { x: viewportCenterX - 140, y: viewportCenterY - 100 }, 
              { url: base64, base64, label: '粘贴图片', loading: false }
            );
            message.success('图片已粘贴');
          };
          reader.readAsDataURL(file);
          return;
        }
      }

      // 检查是否是图片链接
      const text = e.clipboardData?.getData('text/plain');
      if (text && isImageUrl(text)) {
        // 检查当前焦点是否在输入框内
        const activeElement = document.activeElement;
        if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
          return; // 在输入框内不处理
        }
        
        e.preventDefault();
        const viewportCenterX = -viewport.x / viewport.zoom + (window.innerWidth / 2) / viewport.zoom;
        const viewportCenterY = -viewport.y / viewport.zoom + (window.innerHeight / 2) / viewport.zoom;
        
        addNode('image', 
          { x: viewportCenterX - 140, y: viewportCenterY - 100 }, 
          { url: text.trim(), label: '网络图片', loading: false }
        );
        message.success('图片链接已粘贴');
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [viewport, addNode, isLocked]);

  // 初始化 projects
  useEffect(() => {
    initProjects();
  }, [initProjects]);

  useEffect(() => {
    if (canvasDocumentId && projects.length > 0) {
      loadProject(canvasDocumentId, getProjectCanvas);
    }
  }, [canvasDocumentId, projects.length, loadProject, getProjectCanvas]);

  useEffect(() => {
    if (!canvasDocumentId) return;
    const timer = setInterval(() => {
      saveProject(updateProjectCanvas);
    }, 5000);
    return () => clearInterval(timer);
  }, [canvasDocumentId, nodes, edges, saveProject, updateProjectCanvas]);

  const handleAddNode = (type: string) => {
    const viewportCenterX = -viewport.x / viewport.zoom + (window.innerWidth / 2) / viewport.zoom;
    const viewportCenterY = -viewport.y / viewport.zoom + (window.innerHeight / 2) / viewport.zoom;
    addNode(type, { x: viewportCenterX - 100, y: viewportCenterY - 100 });
    setShowNodeMenu(false);
  };

  const createImageNodeFromMaterial = useCallback(
    (item: CanvasMaterialItem, position?: { x: number; y: number }) => {
      if (!item.cover) {
        message.info('该素材暂不支持插入到图片节点');
        return;
      }

      const viewportCenterX = -viewport.x / viewport.zoom + (window.innerWidth / 2) / viewport.zoom;
      const viewportCenterY = -viewport.y / viewport.zoom + (window.innerHeight / 2) / viewport.zoom;
      const targetPosition = position || { x: viewportCenterX - 140, y: viewportCenterY - 100 };

      addNode('image', targetPosition, {
        url: item.cover,
        thumbnail: item.cover,
        label: item.title,
        loading: false,
        sourceType: item.category,
        sourceAssetId: item.id,
        sourceLibrary: item.library,
      });
    },
    [addNode, viewport]
  );

  // 点击画布空白区域时关闭节点菜单
  const handlePaneClick = useCallback(() => {
    setShowNodeMenu(false);
  }, []);

  const handleMaterialSelect = useCallback((item: CanvasMaterialItem) => {
    createImageNodeFromMaterial(item);
    message.success(`已将“${item.title}”插入画布`);
  }, [createImageNodeFromMaterial]);

  const handleCanvasDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (isLocked || !event.dataTransfer.types.includes(MATERIAL_DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsCanvasMaterialDragOver(true);
  }, [isLocked]);

  const handleCanvasDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) {
      setIsCanvasMaterialDragOver(false);
    }
  }, []);

  const handleCanvasDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const raw = event.dataTransfer.getData(MATERIAL_DRAG_MIME);
    setIsCanvasMaterialDragOver(false);
    if (isLocked || !raw) return;

    event.preventDefault();

    try {
      const item = JSON.parse(raw) as CanvasMaterialItem;
      const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      createImageNodeFromMaterial(item, { x: flowPosition.x - 140, y: flowPosition.y - 100 });
      message.success(`已将“${item.title}”拖入画布`);
    } catch {
      message.error('素材读取失败');
    }
  }, [createImageNodeFromMaterial, isLocked, screenToFlowPosition]);

  useEffect(() => {
    const clearCanvasMaterialDragState = () => {
      setIsCanvasMaterialDragOver(false);
    };

    window.addEventListener('dragend', clearCanvasMaterialDragState);
    window.addEventListener('drop', clearCanvasMaterialDragState);

    return () => {
      window.removeEventListener('dragend', clearCanvasMaterialDragState);
      window.removeEventListener('drop', clearCanvasMaterialDragState);
    };
  }, []);

  const nodeTypeOptions = [
    { type: 'text', name: '文本节点', icon: <FileTextOutlined />, color: '#ac2e00' },
    { type: 'imageConfig', name: '文生图配置', icon: <BgColorsOutlined />, color: '#c2410c' },
    { type: 'videoConfig', name: '视频生成配置', icon: <VideoCameraOutlined />, color: '#9a3412' },
    { type: 'effectConfig', name: '效果配置', icon: <BgColorsOutlined />, color: '#d97706' },
    { type: 'templateEffect', name: '视频特效', icon: <BgColorsOutlined />, color: '#b45309' },
    { type: 'image', name: '图片节点', icon: <PictureOutlined />, color: '#ea580c' },
    { type: 'video', name: '视频节点', icon: <VideoCameraOutlined />, color: '#b45309' },
  ];

  // 导出工作流
  const handleExportWorkflow = useCallback(() => {
    const workflow = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      workflowName,
      nodes,
      edges,
      viewport,
    };

    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `workflow_${workflowName}_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
    message.success('工作流已导出');
    setShowProjectMenu(false);
  }, [nodes, edges, viewport, workflowName]);

  // 导出 IndexedDB 原始数据
  const handleExportDatabase = useCallback(async () => {
    try {
      const data = await getAllProjects();
      
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        count: data.length,
        projects: data,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `canvas-database-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      message.success(`已导出 ${data.length} 个项目`);
      setShowProjectMenu(false);
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败');
    }
  }, []);

  // 清空画布
  const handleClearCanvas = useCallback(() => {
    if (nodes.length === 0 && edges.length === 0) {
      message.info('画布已经是空的');
      return;
    }
    Modal.confirm({
      title: '清空画布',
      content: '确定要清空所有节点和连接吗？此操作不可撤销。',
      okText: '清空',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        useCanvasStore.setState({ nodes: [], edges: [] });
        // 自动保存到项目
        setTimeout(() => {
          useCanvasStore.getState().saveProject(updateProjectCanvas);
        }, 100);
        message.success('画布已清空');
      },
    });
  }, [nodes.length, edges.length, updateProjectCanvas]);

  // 锁定/解锁画布
  const handleToggleLock = useCallback(() => {
    setIsLocked(prev => {
      const newState = !prev;
      message.info(newState ? '画布已锁定' : '画布已解锁');
      return newState;
    });
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-[hsl(var(--surface))] text-[hsl(var(--on-surface))]">
      <header className="h-16 flex items-center justify-between px-6 bg-[hsl(var(--surface))]/95 backdrop-blur-md border-b border-[hsl(var(--outline-variant))]/20 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleBackNavigation}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-high))] hover:text-[hsl(var(--on-surface))] transition-colors"
          >
            <ArrowLeftOutlined style={{ fontSize: 16 }} />
          </button>
          <div className="relative">
            <button 
              onClick={() => setShowProjectMenu(!showProjectMenu)}
              className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-[hsl(var(--surface-container-low))] transition-colors"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl signature-gradient text-white shadow-sm">
                <PictureOutlined style={{ fontSize: 16 }} />
              </div>
              <div className="text-left leading-tight">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[hsl(var(--secondary))]">{workflowContextLabel}</div>
                <span className="text-sm font-bold tracking-tight text-[hsl(var(--on-surface))]">{workflowName}</span>
              </div>
              <DownOutlined style={{ fontSize: 12, color: 'hsl(var(--secondary))' }} />
            </button>
            {showProjectMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowProjectMenu(false)}
                />
                <div className="absolute left-0 top-full mt-2 min-w-[180px] rounded-2xl border border-[hsl(var(--outline-variant))]/50 bg-[hsl(var(--surface-container-lowest))]/95 p-1.5 shadow-xl shadow-black/5 backdrop-blur-md z-50">
                  <button
                    onClick={handleExportWorkflow}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[hsl(var(--surface-container-low))] transition-colors text-left text-sm"
                  >
                    <DownloadOutlined style={{ fontSize: 14 }} />
                    <span>导出工作流</span>
                  </button>
                  <button
                    onClick={handleExportDatabase}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[hsl(var(--surface-container-low))] transition-colors text-left text-sm"
                  >
                    <DownloadOutlined style={{ fontSize: 14 }} />
                    <span>导出数据库</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Center Navigation */}
        <nav className="hidden md:flex items-center gap-3 rounded-2xl bg-[hsl(var(--surface-container-low))] p-1">
          <button className="rounded-xl bg-[hsl(var(--surface-container-highest))] px-4 py-2 text-xs font-bold tracking-[0.24em] text-[hsl(var(--on-surface))] shadow-sm">
            画布
          </button>
          <button 
            onClick={handleBackNavigation}
            className="px-3 py-2 text-xs tracking-[0.2em] text-[hsl(var(--secondary))] hover:text-[hsl(var(--on-surface))] transition-colors"
          >
            {backTarget.label}
          </button>
        </nav>
        
        <div className="flex items-center gap-2">
          {allowApiKeyConfig && (
            <Tooltip title="API 设置" placement="bottom">
              <button
                onClick={() => setShowApiSettings(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[hsl(var(--outline-variant))]/30 bg-[hsl(var(--surface-container-low))] text-[hsl(var(--secondary))] transition-colors hover:bg-[hsl(var(--surface-container-high))] hover:text-[hsl(var(--on-surface))]"
                title="API 设置"
              >
                <SettingOutlined style={{ fontSize: 16 }} />
              </button>
            </Tooltip>
          )}
          <button
            onClick={handleClearCanvas}
            className="flex items-center gap-2 rounded-xl border border-red-500/15 bg-red-500/5 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10"
            title="清空画布"
          >
            <DeleteOutlined style={{ fontSize: 15 }} />
            <span>清空画布</span>
          </button>
        </div>
      </header>

      <div 
        className="flex-1 relative overflow-hidden h-full cursor-grab"
        onDragOver={handleCanvasDragOver}
        onDragLeave={handleCanvasDragLeave}
        onDrop={handleCanvasDrop}
        style={{
          backgroundImage: 'radial-gradient(circle at top right, rgba(172, 46, 0, 0.08), transparent 28%), radial-gradient(circle at left 20%, rgba(215, 59, 0, 0.06), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.9), rgba(248,244,240,0.94))',
          backgroundBlendMode: 'normal',
          backgroundSize: '40px 40px',
          backgroundColor: 'hsl(var(--surface))'
        }}
      >
        {isCanvasMaterialDragOver && (
          <div className="pointer-events-none absolute inset-5 z-30 flex items-center justify-center rounded-[28px] border-2 border-dashed border-[hsl(var(--primary))]/45 bg-[hsl(var(--primary))]/8">
            <div className="rounded-2xl bg-[hsl(var(--surface-container-lowest))]/95 px-5 py-3 text-sm font-semibold text-[hsl(var(--primary))] shadow-lg backdrop-blur">
              松手即可在画布中创建图片节点
            </div>
          </div>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={isLocked ? undefined : onNodesChange}
          onEdgesChange={isLocked ? undefined : onEdgesChange}
          onConnect={isLocked ? undefined : onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultViewport={viewport}
          onMove={(_, newViewport) => updateViewport(newViewport)}
          onPaneClick={handlePaneClick}
          fitView
          snapToGrid
          snapGrid={[20, 20]}
          minZoom={0.1}
          maxZoom={2}
          className={isDark ? 'dark' : ''}
          nodesDraggable={!isLocked}
          nodesConnectable={!isLocked}
          elementsSelectable={!isLocked}
          selectionMode={SelectionMode.Partial}
          selectionOnDrag={!isLocked}
          panOnDrag={false}
          panActivationKeyCode="Space"
          multiSelectionKeyCode={['Meta', 'Control']}
        >
          {showGrid && <Background gap={20} size={1} />}
          <MiniMap position="bottom-right" pannable zoomable />
        </ReactFlow>

        <aside className="absolute left-4 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1 rounded-[20px] border border-[hsl(var(--outline-variant))]/40 bg-[hsl(var(--surface-container-lowest))]/90 p-2 shadow-xl shadow-black/5 backdrop-blur-md">
          <Tooltip title="添加节点" placement="right">
            <button
              onClick={() => setShowNodeMenu(!showNodeMenu)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl signature-gradient text-white transition-all shadow-md hover:opacity-90"
            >
              <PlusOutlined style={{ fontSize: 20 }} />
            </button>
          </Tooltip>
          <Tooltip title="工作流模板" placement="right">
            <button
              onClick={() => {
                setShowWorkflowPanel(true);
                setShowMaterialPanel(false);
              }}
              className="flex h-11 w-11 items-center justify-center rounded-2xl text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-low))] hover:text-[hsl(var(--on-surface))] transition-colors"
            >
              <AppstoreOutlined style={{ fontSize: 20 }} />
            </button>
          </Tooltip>
          <Tooltip title="我的素材" placement="right">
            <button
              onClick={() => {
                setShowMaterialPanel((current) => {
                  const next = !current;
                  if (next) {
                    setShowWorkflowPanel(false);
                  }
                  return next;
                });
              }}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-colors ${
                showMaterialPanel
                  ? 'bg-[hsl(var(--surface-container-high))] text-[hsl(var(--on-surface))]'
                  : 'text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-low))] hover:text-[hsl(var(--on-surface))]'
              }`}
            >
              <DeploymentUnitOutlined style={{ fontSize: 20 }} />
            </button>
          </Tooltip>
          <div className="my-1 h-px w-full bg-[hsl(var(--outline-variant))]/40" />
          <Tooltip title="撤销" placement="right">
            <button
              onClick={undo}
              disabled={!canUndo()}
              className="flex h-11 w-11 items-center justify-center rounded-2xl text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-low))] hover:text-[hsl(var(--on-surface))] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <UndoOutlined style={{ fontSize: 20 }} />
            </button>
          </Tooltip>
          <Tooltip title="重做" placement="right">
            <button
              onClick={redo}
              disabled={!canRedo()}
              className="flex h-11 w-11 items-center justify-center rounded-2xl text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-low))] hover:text-[hsl(var(--on-surface))] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <RedoOutlined style={{ fontSize: 20 }} />
            </button>
          </Tooltip>
        </aside>

        {showNodeMenu && (
          <div className="absolute left-20 top-1/2 z-20 -translate-y-1/2 rounded-[24px] border border-[hsl(var(--outline-variant))]/50 bg-[hsl(var(--surface-container-lowest))]/95 p-2 shadow-xl shadow-black/5 backdrop-blur-md">
            {nodeTypeOptions.map((nodeType) => (
              <button
                key={nodeType.type}
                onClick={() => handleAddNode(nodeType.type)}
                className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-[hsl(var(--surface-container-low))]"
              >
                <span style={{ color: nodeType.color, fontSize: 20 }}>{nodeType.icon}</span>
                <span className="text-sm text-[hsl(var(--on-surface))]">{nodeType.name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-[20px] border border-[hsl(var(--outline-variant))]/40 bg-[hsl(var(--surface-container-lowest))]/90 p-1.5 shadow-xl shadow-black/5 backdrop-blur-md">
          <button
            onClick={() => fitView({ padding: 0.2 })}
            className="rounded-xl p-2.5 text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-low))] hover:text-[hsl(var(--on-surface))] transition-colors"
            title="适应视图"
          >
            <AimOutlined style={{ fontSize: 16 }} />
          </button>
          <div className="h-5 w-px bg-[hsl(var(--outline-variant))]/40" />
          <div className="flex items-center gap-1 px-2">
            <button onClick={() => zoomOut()} className="rounded-lg p-1.5 text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-low))] hover:text-[hsl(var(--on-surface))] transition-colors">
              <MinusOutlined style={{ fontSize: 14 }} />
            </button>
            <span className="min-w-[48px] text-center text-xs font-medium text-[hsl(var(--secondary))]">
              {Math.round(viewport.zoom * 100)}%
            </span>
            <button onClick={() => zoomIn()} className="rounded-lg p-1.5 text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-low))] hover:text-[hsl(var(--on-surface))] transition-colors">
              <PlusOutlined style={{ fontSize: 14 }} />
            </button>
          </div>
          <div className="h-5 w-px bg-[hsl(var(--outline-variant))]/40" />
          <button
            onClick={handleToggleLock}
            className={`p-2 rounded transition-colors ${
              isLocked 
                ? 'bg-amber-500/15 text-amber-600 hover:bg-amber-500/20' 
                : 'text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-low))] hover:text-[hsl(var(--on-surface))]'
            }`}
            title={isLocked ? '解锁画布' : '锁定画布'}
          >
            {isLocked ? <LockOutlined style={{ fontSize: 16 }} /> : <UnlockOutlined style={{ fontSize: 16 }} />}
          </button>
          <button
            onClick={() => {
              message.info('左键拖拽空白区可框选节点，按住 Space 再拖拽可移动画布');
            }}
            className="p-2 rounded text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-low))] hover:text-[hsl(var(--on-surface))] transition-colors"
            title="左键拖拽空白区框选，按住 Space 拖动画布"
          >
            <DragOutlined style={{ fontSize: 16 }} />
          </button>
        </div>

        {/* 对齐工具栏 - 选中多个节点时显示 */}
        {selectedNodes.length >= 2 && (
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-[20px] border border-[hsl(var(--outline-variant))]/40 bg-[hsl(var(--surface-container-lowest))]/90 p-1.5 shadow-xl shadow-black/5 backdrop-blur-md">
            <span className="px-2 text-xs font-medium text-[hsl(var(--secondary))]">对齐 ({selectedNodes.length})</span>
            <div className="h-5 w-px bg-[hsl(var(--outline-variant))]/40" />
            <button
              onClick={() => alignNodes('left')}
              className="rounded-xl p-2 text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-low))] hover:text-[hsl(var(--on-surface))] transition-colors"
              title="左对齐"
            >
              <AlignLeftOutlined style={{ fontSize: 16 }} />
            </button>
            <button
              onClick={() => alignNodes('horizontal-center')}
              className="rounded-xl p-2 text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-low))] hover:text-[hsl(var(--on-surface))] transition-colors"
              title="水平居中"
            >
              <AlignCenterOutlined style={{ fontSize: 16 }} />
            </button>
            <button
              onClick={() => alignNodes('right')}
              className="rounded-xl p-2 text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-low))] hover:text-[hsl(var(--on-surface))] transition-colors"
              title="右对齐"
            >
              <AlignRightOutlined style={{ fontSize: 16 }} />
            </button>
            <div className="h-5 w-px bg-[hsl(var(--outline-variant))]/40" />
            <button
              onClick={() => alignNodes('top')}
              className="rounded-xl p-2 text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-low))] hover:text-[hsl(var(--on-surface))] transition-colors"
              title="顶部对齐"
            >
              <VerticalAlignTopOutlined style={{ fontSize: 16 }} />
            </button>
            <button
              onClick={() => alignNodes('vertical-center')}
              className="rounded-xl p-2 text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-low))] hover:text-[hsl(var(--on-surface))] transition-colors"
              title="垂直居中"
            >
              <VerticalAlignMiddleOutlined style={{ fontSize: 16 }} />
            </button>
            <button
              onClick={() => alignNodes('bottom')}
              className="rounded-xl p-2 text-[hsl(var(--secondary))] hover:bg-[hsl(var(--surface-container-low))] hover:text-[hsl(var(--on-surface))] transition-colors"
              title="底部对齐"
            >
              <VerticalAlignBottomOutlined style={{ fontSize: 16 }} />
            </button>
            <div className="h-5 w-px bg-[hsl(var(--outline-variant))]/40" />
            <button
              onClick={autoAlignNodes}
              className="rounded-xl p-2 text-[hsl(var(--secondary))] hover:bg-[hsl(var(--primary))]/10 hover:text-[hsl(var(--primary))] transition-colors"
              title="自动展开（按执行顺序）"
            >
              <SplitCellsOutlined style={{ fontSize: 16 }} />
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <WorkflowPanel visible={showWorkflowPanel} onClose={() => setShowWorkflowPanel(false)} />
      <MaterialPanel
        visible={showMaterialPanel}
        onClose={() => setShowMaterialPanel(false)}
        onSelectMaterial={handleMaterialSelect}
      />
      {allowApiKeyConfig && <ApiSettings visible={showApiSettings} onClose={() => setShowApiSettings(false)} />}
    </div>
  );
};

const Canvas: React.FC = () => (
  <ReactFlowProvider>
    <CanvasInner />
  </ReactFlowProvider>
);

export default Canvas;
