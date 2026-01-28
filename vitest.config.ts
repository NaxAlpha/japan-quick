/**
 * Vitest configuration for testing with Cloudflare Workers
 */

import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: 'wrangler.toml' },
        singleWorker: true,
        isolatedStorage: false // Required for projects with Workflows
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/frontend/**/*',
        'vitest.config.ts'
      ],
      // Thresholds disabled until tests are implemented
      // Set to 0 to allow CI to pass without test coverage
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0
      }
    }
  }
});
