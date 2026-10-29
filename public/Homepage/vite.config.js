import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Served from the root of overtone.games (custom domain on GitHub Pages).
  // If the custom domain is ever removed, change this to '/overtone/'.
  base: '/',
  build: {
    target: 'es2018',
  },
});
