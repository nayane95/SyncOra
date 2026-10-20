import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: { baseURL: "http://127.0.0.1:5174", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev -- --port 5174",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SUPABASE_URL: "https://syncora-test.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
