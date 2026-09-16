import { test, expect } from "@playwright/test";

// 計画書 Phase 2 の代表幅。横スクロールが出ないことをすべての工程で確認します。
const widths = [360, 375, 390, 430, 768, 820, 1024, 1280];
const steps = ["source", "format", "settings", "preview"];

for (const width of widths) {
  test(`幅${width}pxで横スクロールが発生しない`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "変換を始める" }).first().click();

    for (const step of steps) {
      // 工程タブはスマホ幅でしか見えないため、body の data-step を直接切り替えて全カードを検査します。
      await page.evaluate((target) => { document.body.dataset.step = target; }, step);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `工程「${step}」で${overflow}pxはみ出しています`).toBeLessThanOrEqual(0);
    }
  });
}

test("原稿を入れるとプレビューとコピーボタンが有効になる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "変換を始める" }).first().click();
  await page.locator("#source").fill("# 見出し\n\n本文です。");
  await expect(page.locator("#copyResult")).toBeEnabled();
  await expect(page.locator("#preview h1")).toHaveText("見出し");
});
