import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'copy-extension-files',
      closeBundle() {
        const dist = resolve(__dirname, 'dist');
        if (!existsSync(resolve(dist, 'icons'))) mkdirSync(resolve(dist, 'icons'), { recursive: true });
        copyFileSync(resolve(__dirname, 'manifest.json'), resolve(dist, 'manifest.json'));
        for (const size of ['16', '48', '128']) {
          const src = resolve(__dirname, `icons/icon-${size}.png`);
          if (existsSync(src)) copyFileSync(src, resolve(dist, `icons/icon-${size}.png`));
        }
      },
    },
  ],
  base: '',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
      },
    },
  },
  define: {
    __BUILD_CONFIG__: JSON.stringify(require('./app.build.ts')),
  },
});
