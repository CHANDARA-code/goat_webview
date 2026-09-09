import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 3003,
    host: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 4096,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
});
