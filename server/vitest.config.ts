import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Each test file gets its own throwaway database (see test/setup.ts).
    setupFiles: ['./test/setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
  },
});
