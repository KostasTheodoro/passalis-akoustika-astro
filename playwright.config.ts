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
  // Tests run against the real build output, served by `scripts/preview-server.ts`.
  //
  // This used to be `astro preview`. STEP-08 added `/api/contact`, which makes the build
  // hybrid, and the Vercel adapter has no preview entrypoint: `astro preview` now exits
  // with "does not support the preview command". The replacement serves the prerendered
  // HTML from `dist/client` and hands everything else to the actual bundled function, so
  // the endpoint is exercised as deployed rather than mocked.
  //
  // `astro dev` remains deliberately avoided: Astro detects AI-agent environments and runs
  // the dev server as a detached background process, which leaves the port held and the
  // test runner watching a process that has already exited.
  webServer: {
    command: `bun run build && bun run scripts/preview-server.ts --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
