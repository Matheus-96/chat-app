import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'AI_PROVIDER=mock npm run dev',
      cwd: '../backend',
      url: 'http://localhost:3001/health',
      reuseExistingServer: true,
      timeout: 15_000,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173/chat-app/',
      reuseExistingServer: true,
      timeout: 15_000,
    },
  ],
})
