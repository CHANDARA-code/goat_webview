import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    hmr: true,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
