import { defineConfig, devices } from "@playwright/test";

// 画面幅・オフライン起動などブラウザが必要な検査だけをここで扱います。
// 変換規則のテストは tests/ にあり、Node だけで動くので Playwright は不要です。
// 対象はWindows代表のChromiumと、iOS Safariの代替としてのWebKitです（実機の代わりにはなりません）。
// ReDesign 等で元企画と同時に起動するときは PORT で分ける（例: PORT=8766）。
const port = process.env.PORT ?? "8765";

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: 0,
  reporter: [["list"]],
  webServer: {
    command: `node tools/serve.mjs ${port}`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: true
  },
  use: {
    baseURL: `http://127.0.0.1:${port}/`,
    locale: "ja-JP"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } }
  ]
});
