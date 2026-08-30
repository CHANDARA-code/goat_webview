import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: 'https://appassets.androidplatform.net/assets/',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'static',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/') ||
            id.includes('/react-is/')
          ) {
            return 'vendor';
          }
          if (
            id.includes('/antd/') ||
            id.includes('/@ant-design/') ||
            id.includes('/@rc-component/') ||
            id.includes('/rc-') ||
            id.includes('/dayjs/')
          ) {
            return 'antd';
          }
          return undefined;
        }
      }
    }
  }
});
