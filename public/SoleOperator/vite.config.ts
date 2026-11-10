import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Served at overtone.games/sole-operator/. CI copies dist/ into the homepage's
// dist/sole-operator/ before uploading to GitHub Pages (see .github/workflows/deploy.yml).
export default defineConfig({
  base: '/sole-operator/',
  plugins: [react()],
  server: { port: 5175, strictPort: true },
  preview: { port: 4174, strictPort: true },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        // Keep the heavy 3D libraries in their own long-cached chunk; the title
        // screen and HUD code stay small and load first.
        codeSplitting: {
          groups: [
            // React + zustand are needed by the title screen; keep them out of the 3D chunks.
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler|zustand|use-sync-external-store)[\\/]/,
              priority: 3,
            },
            { name: 'three', test: /node_modules[\\/](three|postprocessing)[\\/]/, priority: 2 },
            {
              name: 'r3f',
              test: /node_modules[\\/](@react-three|three-stdlib|troika|camera-controls|maath|its-fine|suspend-react)/,
              priority: 1,
            },
          ],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
