import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'demo' ? [{
    name: 'folio-demo-html',
    transformIndexHtml: (html: string) => html
      .replace(/<link rel="manifest"[^>]*\/>/, '')
      .replace('<title>Folio · 你的全球信息册</title>', '<title>Folio 在线演示 · 探索你的世界</title>'),
  }] : [])],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { proxy: { '/api': 'http://localhost:8787' } },
}));
