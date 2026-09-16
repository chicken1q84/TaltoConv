import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// 計画書 Phase C: Web版（dist/）のオフライン起動と、新しい版の検出→再読み込みを自動で確認します。
// Service Worker の登録は Chromium で検査します（WebKit は Playwright 上の SW 対応が限定的なため）。
// dist/ は事前に `node tools/build-release.mjs --web-only` で作っておく必要があります。
//
// 更新の検査は「配信中のファイルを書き換える」必要があるため、dist/ を一時フォルダへ複製し、
// そのフォルダを専用のローカルサーバー（tools/serve.mjs）で配信します。
// サーバーはテストごとに別ポートで起動し、終了時に止めます。

const root = resolve(import.meta.dirname, "..");
const distDir = resolve(root, "dist");
const port = 8791;
const origin = `http://127.0.0.1:${port}/`;

test.describe.configure({ mode: "serial" });
test.skip(({ browserName }) => browserName !== "chromium", "Service Worker の検査は Chromium だけで行う");
test.skip(() => !existsSync(join(distDir, "index.html")), "dist/ が無い。先に node tools/build-release.mjs --web-only を実行する");

let serveDir;
let server;

test.beforeAll(async () => {
  serveDir = mkdtempSync(join(tmpdir(), "taltoconv-pwa-"));
  cpSync(distDir, serveDir, { recursive: true });
  server = spawn(process.execPath, [resolve(root, "tools/serve.mjs"), String(port), serveDir], { stdio: "ignore" });
  // サーバーが待ち受けを始めるまで待ちます。
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { await fetch(origin); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error("検査用サーバーを起動できませんでした");
});

test.afterAll(() => {
  server?.kill();
  if (serveDir) rmSync(serveDir, { recursive: true, force: true });
});

/** Service Worker が有効になり、この画面を制御するまで待ちます。 */
async function waitForServiceWorker(page) {
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return Boolean(registration?.active) && Boolean(navigator.serviceWorker.controller);
  }, null, { timeout: 15_000 });
}

test("初回表示後、オフラインでも起動して変換できる", async ({ page, context }) => {
  await page.goto(origin);
  await waitForServiceWorker(page);
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const cache = await caches.open(names[0]);
    return (await cache.keys()).length;
  });
  expect(cached).toBeGreaterThanOrEqual(12);

  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle(/TaltoConv/);
  await page.getByRole("button", { name: "変換を始める" }).first().click();
  await page.locator("#source").fill("# オフライン\n\n本文です。");
  await expect(page.locator("#preview h1")).toHaveText("オフライン");
  await expect(page.locator("#copyResult")).toBeEnabled();
  // 画面の CSS もキャッシュから当たっていること（背景色が既定値になっていないこと）
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).not.toBe("rgba(0, 0, 0, 0)");
  await context.setOffline(false);
});

test("配信ファイルが更新されると案内が出て、再読み込みで新しい版になる", async ({ page }) => {
  await page.goto(origin);
  await waitForServiceWorker(page);
  await expect(page.locator("#appVersion")).toHaveText(/^\d/);
  await expect(page.locator("#updateNotice")).toBeHidden();

  // 配信側で「版を上げた」状態を作ります。index.html の表示バージョンと sw.js の BUILD_ID を変えます。
  const indexPath = join(serveDir, "index.html");
  const swPath = join(serveDir, "sw.js");
  writeFileSync(indexPath, readFileSync(indexPath, "utf8").replace(/<meta name="app-version" content="[^"]+">/, '<meta name="app-version" content="9.9.9-test">'), "utf8");
  writeFileSync(swPath, readFileSync(swPath, "utf8").replace(/const BUILD_ID = "[^"]+";/, 'const BUILD_ID = "test-update";'), "utf8");

  // 再読み込みで Service Worker の更新確認が走り、新しい版が待機状態になると案内が出ます。
  await page.reload();
  await expect(page.locator("#updateNotice")).toBeVisible({ timeout: 15_000 });
  await page.locator("#reloadForUpdate").click();
  await expect(page.locator("#appVersion")).toHaveText("9.9.9-test", { timeout: 15_000 });
  await expect(page.locator("#updateNotice")).toBeHidden();
  // 古い版のキャッシュは削除され、新しい版のキャッシュだけが残ります。
  const cacheNames = await page.evaluate(() => caches.keys());
  expect(cacheNames).toHaveLength(1);
  expect(cacheNames[0]).toContain("test-update");
});
