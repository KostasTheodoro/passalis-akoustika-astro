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
  // Tests run against the real build output via `astro preview`, not `astro dev`.
  // For a static build with an adapter that has no preview entrypoint, Astro serves
  // `dist/` from its own static preview server, and the CLI stays in the foreground.
  // `astro dev` is deliberately avoided: Astro detects AI-agent environments and runs
  // the dev server as a detached background process, which leaves the port held and
  // the test runner watching a process that has already exited.
  webServer: {
    command: `bun run build && bun run preview --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
