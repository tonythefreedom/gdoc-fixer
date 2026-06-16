import { defineConfig, devices } from '@playwright/test';

// Headed mode by default — 사용자가 직접 화면을 보면서 확인.
export default defineConfig({
  testDir: './tests',
  // 수동 로그인 단계를 포함하므로 충분히 길게.
  timeout: 300_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    headless: false,
    baseURL: 'https://gdoc-fixer.web.app',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], headless: false },
    },
  ],
});
