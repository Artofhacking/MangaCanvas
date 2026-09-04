import React, { useRef, useEffect } from 'react';
import { message } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { WORKFLOW_TEMPLATES } from '../config/workflows';
import { useCanvasStore } from '../stores/canvasStore';
import { useCanvasDocumentsStore } from '../stores/projectsStore';
import type { WorkflowTemplate } from '../config/workflows';

interface WorkflowPanelProps {
  visible: boolean;
  onClose: () => void;
}

const WorkflowPanel: React.FC<WorkflowPanelProps> = ({ visible, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const { nodes, addNode, addEdgeManually, saveHistory } = useCanvasStore();
  const { updateProjectCanvas } = useCanvasDocumentsStore();

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (visible) {
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [visible, onClose]);

  const handleAddWorkflow = (template: WorkflowTemplate) => {
    try {
      // 计算起始位置（视口中心）
      const startPosition = {
        x: Math.max(...nodes.map((n) => n.position.x), 200) + 300,
        y: 100,
      };

      // 生成节点和边
      const { nodes: newNodes, edges: newEdges } = template.createNodes(startPosition);

      // 节点ID映射
      const nodeIdMap = new Map<string, string>();

      // 添加所有节点
      newNodes.forEach((node) => {
        if (node.id && node.type && node.position && node.data) {
          const newNodeId = addNode(node.type, node.position, {
            ...node.data,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          nodeIdMap.set(node.id, newNodeId);
        }
      });

      // 添加所有边（使用新的节点ID）
      setTimeout(() => {
        newEdges.forEach((edge) => {
          if (edge.source && edge.target) {
            const newSource = nodeIdMap.get(edge.source) || edge.source;
            const newTarget = nodeIdMap.get(edge.target) || edge.target;
            addEdgeManually({
              ...edge,
              source: newSource,
              target: newTarget,
              sourceHandle: edge.sourceHandle || 'right',
              targetHandle: edge.targetHandle || 'left',
            });
          }
        });
        saveHistory();
        // 自动保存到项目 - 使用 getState 获取最新状态
        setTimeout(() => {
          useCanvasStore.getState().saveProject(updateProjectCanvas);
        }, 100);
      }, 100);

      message.success(`已添加工作流: ${template.name}`);
      onClose();
    } catch (error) {
      console.error('添加工作流失败:', error);
      message.error('添加工作流失败');
    }
  };

  if (!visible) return null;

  const workflows = WORKFLOW_TEMPLATES;

  return (
    <div
      ref={panelRef}
      className="fixed left-[72px] top-[100px] w-[520px] max-h-[70vh] bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl z-[100] overflow-hidden flex flex-col"
      style={{
        backdropFilter: 'blur(12px)',
        animation: visible ? 'slideIn 0.25s ease' : 'slideOut 0.25s ease',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <span className="text-[15px] text-gray-900 dark:text-white font-medium">
          工作流模版
        </span>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
        >
          <CloseOutlined className="text-sm" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-3 gap-4">
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              className="cursor-pointer transition-transform hover:-translate-y-0.5"
              onClick={() => handleAddWorkflow(workflow)}
            >
              <div className="aspect-square rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-700 flex items-center justify-center hover:border-blue-500 transition-colors">
                {workflow.cover ? (
                  <img src={workflow.cover} alt={workflow.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl text-gray-400">📋</span>
                )}
              </div>
              <div className="mt-2.5 text-[13px] text-gray-900 dark:text-white text-center overflow-hidden text-ellipsis whitespace-nowrap">
                {workflow.name}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-12px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slideOut {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(-12px);
          }
        }
      `}</style>
    </div>
  );
};

export default WorkflowPanel;
