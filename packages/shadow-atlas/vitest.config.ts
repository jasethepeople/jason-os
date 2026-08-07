import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: [
      { find: /^(.*)\.js$/, replacement: '$1' },
    ],
  },
});
