import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { defineConfig } from 'vite';
export default defineConfig({
  base: process.env.VITE_BASE_PATH || './',
  plugins: [react(), tailwind()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules') && /recharts|d3-|victory-vendor/.test(id))
            return 'charts';
          if (id.includes('node_modules') && id.includes('katex')) return 'math';
        },
      },
    },
  },
});
