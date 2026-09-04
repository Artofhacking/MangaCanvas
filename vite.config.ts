import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // rewrite: (path) => path.replace(/^\/api/, ''), // 如果后端路径不需要 /api 前缀则启用
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // 核心库分离
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // UI 库分离
          'vendor-ui': ['antd', '@ant-design/icons', 'lucide-react'],
          // 第三方大库分离
          'vendor-heavy': ['reactflow', 'zustand', 'axios'],
        },
      },
    },
    // 调整 chunk 大小警告阈值
    chunkSizeWarningLimit: 800,
  },
})
