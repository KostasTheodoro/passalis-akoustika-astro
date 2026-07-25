import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Tests run against the real build output, served from a single Bun process.
  // `astro dev` is unsuitable: it starts its server in a child process and lets the
  // parent exit, so Playwright either loses track of the server or hangs on teardown
  // with the port still held. `astro preview` is not supported by the Vercel adapter.
  webServer: {
    command: `bun run build && bun tests/serve-dist.ts`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
