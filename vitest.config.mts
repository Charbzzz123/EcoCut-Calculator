/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage/ecocut-calculator',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        perFile: true,
        statements: 99,
        branches: 99,
        functions: 99,
        lines: 99
      }
    }
  }
});
