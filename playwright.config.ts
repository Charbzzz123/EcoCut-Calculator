import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dataDir = mkdtempSync(join(tmpdir(), 'ecocut-playwright-'));
const frontendUrl = 'http://127.0.0.1:4208';
const backendUrl = 'http://127.0.0.1:3200';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL: frontendUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      testIgnore: '**/*.mobile.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      testMatch: '**/*.mobile.spec.ts',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
  ],
  webServer: [
    {
      command: 'npm run start:dev --prefix server',
      url: backendUrl,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        PORT: '3200',
        ADDRESS_PROVIDER: 'none',
        ENTRIES_DB_PATH: join(dataDir, 'entries.db'),
        EMPLOYEES_DB_PATH: join(dataDir, 'employees.db'),
        COMMUNICATIONS_DB_PATH: join(dataDir, 'communications.db'),
        ADDRESS_USAGE_DB_PATH: join(dataDir, 'address-usage.db'),
        ENTRIES_STORE_PATH: join(dataDir, 'legacy-entries.json'),
        QUO_API_KEY: '',
        SMTP_PASSWORD: '',
        GOOGLE_CALENDAR_CREDENTIALS: '',
        GOOGLE_CALENDAR_CREDENTIALS_PATH: join(dataDir, 'missing-calendar.json'),
      },
    },
    {
      command:
        'npm run ng -- serve --configuration development --host 127.0.0.1 --port 4208 --proxy-config e2e/proxy.conf.json',
      url: frontendUrl,
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
