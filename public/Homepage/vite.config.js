import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Served from https://rubenpdev.github.io/overtone/ on GitHub Pages.
  base: '/overtone/',
  build: {
    target: 'es2018',
  },
});
