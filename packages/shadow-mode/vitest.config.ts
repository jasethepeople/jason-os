import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  esbuild: {
    target: 'ES2022',
  },
  resolve: {
    alias: {
      '@jason-os/shared': resolve(__dirname, '../shared/src/index.ts'),
      '@jason-os/privacy-kernel': resolve(__dirname, '../privacy-kernel/src/index.ts'),
      '@jason-os/session-manager': resolve(__dirname, '../session-manager/src/index.ts'),
    },
  },
});
