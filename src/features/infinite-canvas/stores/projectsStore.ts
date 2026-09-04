import { create } from 'zustand';
import type { Project, ProjectsStore } from '../types';
import * as db from '../utils/indexedDB';

// 保存操作的防抖延迟
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
const SAVE_DELAY = 500;

export const useCanvasDocumentsStore = create<ProjectsStore>((set, get) => ({
  projects: [],
  currentProjectId: null,

  // Initialize projects from IndexedDB
  initProjects: async () => {
    try {
      // 先尝试从 localStorage 迁移
      await db.migrateFromLocalStorage();
      
      // 从 IndexedDB 加载
      const projects = await db.getAllProjects();
      set({
        projects: (projects as unknown as Project[]).map((p) => ({
          ...p,
          createdAt: new Date(p.createdAt as string | number | Date),
          updatedAt: new Date(p.updatedAt as string | number | Date),
        })),
      });
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  },

  // Save projects to IndexedDB (防抖)
  saveProjects: () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(async () => {
      try {
        const projects = get().projects;
        await db.saveAllProjects(projects as unknown as Record<string, unknown>[]);
      } catch (error) {
        console.error('Failed to save projects:', error);
      }
    }, SAVE_DELAY);
  },

  // Create new project
  createProject: (name = '未命名项目') => {
    const newProject: Project = {
      id: `project_${Date.now()}`,
      name,
      thumbnail: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      canvasData: {
        nodes: [],
        edges: [],
        viewport: { x: 100, y: 50, zoom: 0.8 },
      },
    };
    const newProjects = [newProject, ...get().projects];
    set({ projects: newProjects });
    // 立即同步保存，确保跳转前数据已持久化
    db.saveAllProjects(newProjects as unknown as Record<string, unknown>[]).catch(err => {
      console.error('Failed to save new project:', err);
    });
    return newProject.id;
  },

  createWorkflowDocument: ({ id, name, projectId, sourceType, sourceAssetId }) => {
    const existingProject = get().projects.find((p) => p.id === id);
    if (existingProject) {
      set({
        projects: get().projects.map((project) =>
          project.id === id
            ? {
                ...project,
                name,
                projectId,
                sourceType,
                sourceAssetId,
                updatedAt: new Date(),
              }
            : project
        ),
      });
      get().saveProjects();
      return;
    }

    const workflowProject: Project = {
      id,
      name,
      thumbnail: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      projectId,
      sourceType,
      sourceAssetId,
      canvasData: {
        nodes: [],
        edges: [],
        viewport: { x: 100, y: 50, zoom: 0.8 },
      },
    };

    const newProjects = [workflowProject, ...get().projects];
    set({ projects: newProjects });
    db.saveAllProjects(newProjects as unknown as Record<string, unknown>[]).catch((error) => {
      console.error('Failed to save workflow document:', error);
    });
  },

  // Update project
  updateProject: (id: string, data: Partial<Project>) => {
    set({
      projects: get().projects.map((p) =>
        p.id === id ? { ...p, ...data, updatedAt: new Date() } : p
      ),
    });
    get().saveProjects();
  },

  getProjectById: (id: string) => {
    return get().projects.find((project) => project.id === id) || null;
  },

  // Update project canvas
  updateProjectCanvas: (id: string, canvasData: Partial<Project['canvasData']>) => {
    const existingProject = get().projects.find((p) => p.id === id);

    if (!existingProject) {
      set({
        projects: [
          {
            id,
            name: id.startsWith('episode-')
              ? `片段工作流 ${id.replace(/^episode-/, "")}`
              : `工作流 ${id.replace(/^workflow_/, "")}`,
            thumbnail: '',
            createdAt: new Date(),
            updatedAt: new Date(),
            canvasData: {
              nodes: canvasData.nodes || [],
              edges: canvasData.edges || [],
              viewport: canvasData.viewport || { x: 100, y: 50, zoom: 0.8 },
            },
          },
          ...get().projects,
        ],
      });
      get().saveProjects();
      return;
    }

    set({
      projects: get().projects.map((p) =>
        p.id === id
          ? {
              ...p,
              canvasData: { ...p.canvasData, ...canvasData },
              updatedAt: new Date(),
            }
          : p
      ),
    });
    get().saveProjects();
  },

  // Get project canvas
  getProjectCanvas: (id: string) => {
    const project = get().projects.find((p) => p.id === id);
    return project ? project.canvasData : null;
  },

  // Delete project
  deleteProject: async (id: string) => {
    set({
      projects: get().projects.filter((p) => p.id !== id),
    });
    try {
      await db.deleteProject(id);
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
    get().saveProjects();
  },

  // Rename project
  renameProject: (id: string, name: string) => {
    get().updateProject(id, { name });
  },

  // Duplicate project
  duplicateProject: (id: string) => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) return null;

    const newProject: Project = {
      ...project,
      id: `project_${Date.now()}`,
      name: `${project.name} (复制)`,
      createdAt: new Date(),
      updatedAt: new Date(),
      canvasData: JSON.parse(JSON.stringify(project.canvasData)),
    };

    set({ projects: [newProject, ...get().projects] });
    get().saveProjects();
    return newProject.id;
  },
}));
