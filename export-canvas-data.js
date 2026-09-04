/**
 * 导出 Canvas IndexedDB 数据脚本
 * 在浏览器控制台运行此脚本
 */

const DB_NAME = 'canvas-db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

async function exportCanvasData() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error('打开数据库失败:', request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      const db = request.result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        console.log('没有找到 projects 存储');
        resolve([]);
        return;
      }
      
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        const data = getAllRequest.result;
        console.log('=== Canvas 数据导出 ===');
        console.log(`共 ${data.length} 个项目`);
        console.log('\n完整数据:');
        console.log(JSON.stringify(data, null, 2));
        
        // 下载为文件
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `canvas-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        resolve(data);
      };
      
      getAllRequest.onerror = () => {
        console.error('获取数据失败:', getAllRequest.error);
        reject(getAllRequest.error);
      };
    };
  });
}

// 运行导出
exportCanvasData().then(data => {
  console.log('\n✅ 数据导出完成，文件已下载');
}).catch(err => {
  console.error('❌ 导出失败:', err);
});
