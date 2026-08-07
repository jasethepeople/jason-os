import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
    },
    esbuild: {
        target: 'ES2022',
    },
});
//# sourceMappingURL=vitest.config.js.map