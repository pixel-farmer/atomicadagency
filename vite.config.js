import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        plonk: path.resolve(__dirname, 'plonk.html'),
        creativeDirector: path.resolve(__dirname, 'creative-director.html'),
      },
    },
  },
});
