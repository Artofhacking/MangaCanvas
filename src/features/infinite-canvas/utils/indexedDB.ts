/**
 * IndexedDB 存储工具
 */

const DB_NAME = 'canvas-db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

let dbInstance: IDBDatabase | null = null;

/**
 * 打开/初始化数据库
 */
export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB 打开失败:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // 创建 projects 对象存储
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

/**
 * 保存单个项目
 */
export const saveProject = async (project: Record<string, unknown>): Promise<void> => {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(project);

    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error('保存项目失败:', request.error);
      reject(request.error);
    };
  });
};

/**
 * 批量保存所有项目
 */
export const saveAllProjects = async (projects: Record<string, unknown>[]): Promise<void> => {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // 先清空再写入
    const clearRequest = store.clear();
    
    clearRequest.onsuccess = () => {
      let completed = 0;
      
      if (projects.length === 0) {
        resolve();
        return;
      }

      projects.forEach((project) => {
        const request = store.put(project);
        request.onsuccess = () => {
          completed++;
          if (completed === projects.length) {
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      });
    };
    
    clearRequest.onerror = () => reject(clearRequest.error);
  });
};

/**
 * 获取所有项目
 */
export const getAllProjects = async (): Promise<Record<string, unknown>[]> => {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => {
      console.error('获取项目失败:', request.error);
      reject(request.error);
    };
  });
};

/**
 * 获取单个项目
 */
export const getProject = async (id: string): Promise<Record<string, unknown> | null> => {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

/**
 * 删除单个项目
 */
export const deleteProject = async (id: string): Promise<void> => {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * 从 localStorage 迁移数据到 IndexedDB
 */
export const migrateFromLocalStorage = async (): Promise<boolean> => {
  const STORAGE_KEY = 'canvas-projects';
  const saved = localStorage.getItem(STORAGE_KEY);
  
  if (!saved) return false;
  
  try {
    const projects = JSON.parse(saved);
    if (Array.isArray(projects) && projects.length > 0) {
      await saveAllProjects(projects);
      // 迁移成功后删除 localStorage 数据
      localStorage.removeItem(STORAGE_KEY);
      console.log('数据已从 localStorage 迁移到 IndexedDB');
      return true;
    }
  } catch (error) {
    console.error('迁移数据失败:', error);
  }
  
  return false;
};

/**
 * 检查 IndexedDB 是否可用
 */
export const isIndexedDBAvailable = (): boolean => {
  return typeof indexedDB !== 'undefined';
};
