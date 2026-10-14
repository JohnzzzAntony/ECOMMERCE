// E2E: the full Figma → storefront flow against a throwaway PostgreSQL (bun scripts/test-db.ts start) and a mock
// Figma (e2e/mock-figma.ts). Never uses DATABASE_URL from .env.
//   TEST_DATABASE_URL=… TEST_DATABASE_ADMIN_URL=… bunx playwright test
import { defineConfig, devices } from '@playwright/test'

const PORT = 3100
const MOCK = 'http://127.0.0.1:4010'
const BASE = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',
  use: { baseURL: BASE, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'bun e2e/mock-figma.ts', url: `${MOCK}/v1/me`, reuseExistingServer: true, timeout: 30_000 },
    {
      command: `bunx next dev -p ${PORT}`,
      url: `${BASE}/robots.txt`,
      reuseExistingServer: false,
      timeout: 240_000,
      env: {
        NEXT_DIST_DIR: '.next-e2e',
        DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
        AUTH_SECRET: 'e2e-secret-that-is-at-least-32-characters-long',
        FIGMA_TOKEN_KEYS: '1:MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
        FIGMA_CLIENT_ID: 'e2e-client', FIGMA_CLIENT_SECRET: 'e2e-secret', FIGMA_REDIRECT_URI: `${BASE}/api/design/figma/oauth/callback`,
        FIGMA_API_BASE: MOCK, FIGMA_OAUTH_URL: `${MOCK}/oauth`, FIGMA_TEST_ASSET_ORIGIN: MOCK,
        DESIGN_STORAGE: 'local', NEXT_PUBLIC_SITE_URL: BASE, FEATURE_THEMES: 'false',
      },
    },
  ],
})
