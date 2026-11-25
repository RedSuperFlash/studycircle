import { defineConfig, devices } from '@playwright/test';
const live = Boolean(process.env.E2E_SUPABASE_URL && process.env.E2E_SUPABASE_KEY);
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: live ? '**/*.live.spec.ts' : '**/*.demo.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !live && !process.env.CI,
    env: live
      ? {
          VITE_SUPABASE_URL: process.env.E2E_SUPABASE_URL!,
          VITE_SUPABASE_PUBLISHABLE_KEY: process.env.E2E_SUPABASE_KEY!,
        }
      : { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' },
  },
});
