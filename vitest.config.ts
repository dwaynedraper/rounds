import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 10_000,
    // Every test file shares one local Postgres and truncates it in
    // beforeEach. Running files in parallel makes them clobber each other's
    // data mid-run (flaky: passes locally, races in CI). Serialize files so
    // each has the DB to itself; within a file, tests already run in order.
    fileParallelism: false,
  },
})
