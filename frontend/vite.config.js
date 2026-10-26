import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Порядок важен: более длинные префиксы — раньше общего /api (как location в nginx)
    proxy: {
      '/api/decor': 'http://localhost:3003',
      '/api/events': 'http://localhost:3002',
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
    },
  },
  build: {
    outDir: 'dist',
  },
});
