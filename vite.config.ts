import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// Keep historical review artifacts available locally without deploying them.
const productionPublicFiles = [
  'favicon.svg',
  'THIRD_PARTY_NOTICES.txt',
  'fonts/BarlowCondensed-Black.ttf',
  'fonts/BarlowCondensed-OFL.txt',
  'fonts/manrope-regular.ttf',
  'fonts/manrope-bold.ttf',
  'fonts/Manrope-OFL.txt',
  'renders/hero.webp',
  'renders/side.webp',
  'renders/threequarter.webp',
  'renders/macro.webp',
];
const publicRoot = fileURLToPath(new URL('./public/', import.meta.url));

function currentPublicAssets(): Plugin {
  return {
    name: 'pace-current-public-assets',
    apply: 'build',
    generateBundle() {
      for (const fileName of productionPublicFiles) {
        this.emitFile({
          type: 'asset',
          fileName,
          source: readFileSync(resolve(publicRoot, fileName)),
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const review = mode === 'review';
  return {
    server: { host: '127.0.0.1', port: 4180, strictPort: true },
    preview: { host: '127.0.0.1', port: 4180, strictPort: true },
    plugins: review ? [] : [currentPublicAssets()],
    build: {
      target: 'es2022',
      outDir: review ? 'dist-review' : 'dist',
      // Vite still resolves public URLs during compilation; only copying differs.
      copyPublicDir: review,
      license: { fileName: 'third-party-notices.md' },
      rollupOptions: {
        input: review
          ? { main: 'index.html', studio: 'studio.html', baseline: 'baseline.html' }
          : { main: 'index.html' },
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/three/')) return 'three';
          },
        },
      },
    },
  };
});
