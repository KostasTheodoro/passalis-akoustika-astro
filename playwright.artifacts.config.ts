import { defineConfig, devices } from '@playwright/test';

/**
 * A separate configuration for the review-artifact capture.
 *
 * It is separate rather than a project inside `playwright.config.ts` for one reason: the capture is
 * not a test. It takes screenshots and writes files, it asserts almost nothing, and it must never
 * run as part of `bun run test:e2e` where a slow screenshot would read as a flaky test.
 *
 * It reuses a preview server if one is already up, and starts one otherwise, so it can be run
 * straight after a suite without waiting for another build.
 */
const PORT = 4321;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/artifacts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL, ...devices['Desktop Chrome'] },
  webServer: {
    command: `bun run build && bun run scripts/preview-server.ts --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
