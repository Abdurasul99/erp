import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Отдельный сайт WOW Combinator: собственный корень, никакой связи со сборкой
// mywarehouse.uz. На Vercel: framework Vite, build `npm run build`, output `dist`.
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
});
