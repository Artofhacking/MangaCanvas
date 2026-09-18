import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Absolute base so history deep links (e.g. /project/6/scenes) load
  // /assets/*.js instead of the relative /project/6/assets/*.js white screen.
  base: '/',
  server: {
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:8088',
        changeOrigin: true,
      },
      '/static': {
        target: 'http://localhost:8088',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
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
