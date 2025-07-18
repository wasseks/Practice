import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  root: 'src',
  build: {
    outDir: 'build', 
    assetsDir: 'assets',
    emptyOutDir: true,
    
  },
  server: {
    port: 5173,
  },
});