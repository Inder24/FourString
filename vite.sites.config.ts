import { copyFile, mkdir } from 'node:fs/promises';
import { defineConfig } from 'vite';

// A Fetch-native worker; secrets are supplied only by Sites at runtime.
export default defineConfig({
  publicDir: false,
  build: {
    ssr: 'server/sites-worker.ts',
    outDir: 'dist/server',
    rollupOptions: { output: { entryFileNames: 'index.js' } },
  },
  plugins: [{
    name: 'sites-hosting-metadata',
    async closeBundle() {
      await mkdir('dist/.openai', { recursive: true });
      await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
    },
  }],
});
