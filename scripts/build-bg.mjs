import { build } from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const isWatch = process.argv.includes('--watch');

const ctx = await build({
  entryPoints: [resolve(root, 'src/background/index.ts')],
  bundle: true,
  outfile: resolve(root, 'dist/background.js'),
  format: 'esm',
  target: 'chrome120',
  platform: 'browser',
  define: {
    __BUILD_CONFIG__: JSON.stringify((await import(resolve(root, 'app.build.ts'))).default),
  },
  external: [],
  minify: !isWatch,
  sourcemap: isWatch,
});

if (isWatch) {
  console.log('[background] watching for changes...');
} else {
  console.log('[background] built successfully');
}
