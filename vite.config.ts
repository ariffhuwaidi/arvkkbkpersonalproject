/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/arvkkbkpersonalproject/',
  server: {
    port: 5173,
    host: true
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/setup.ts']
  }
});
