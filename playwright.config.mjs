import { defineConfig, devices } from "@playwright/test";

// 画面幅・オフライン起動などブラウザが必要な検査だけをここで扱います。
// 変換規則のテストは tests/ にあり、Node だけで動くので Playwright は不要です。
// 対象はWindows代表のChromiumと、iOS Safariの代替としてのWebKitです（実機の代わりにはなりません）。
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: 0,
  reporter: [["list"]],
  webServer: {
    command: "node tools/serve.mjs 8765",
    url: "http://127.0.0.1:8765/",
    reuseExistingServer: true
  },
  use: {
    baseURL: "http://127.0.0.1:8765/",
    locale: "ja-JP"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } }
  ]
});
