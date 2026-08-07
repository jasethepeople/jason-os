import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
    },
    resolve: {
        // Support .js extension imports in TypeScript
        alias: [
            { find: /^(.*)\.js$/, replacement: '$1' },
        ],
    },
});
//# sourceMappingURL=vitest.config.js.map