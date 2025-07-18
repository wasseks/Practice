import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'build', 
    assetsDir: 'assets',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});