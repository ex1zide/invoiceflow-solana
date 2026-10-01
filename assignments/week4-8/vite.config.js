import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { buffer: fileURLToPath(new URL('./node_modules/buffer/index.js', import.meta.url)) } },
  define: { global: 'globalThis' },
});
