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
      if (step === "format") await page.locator("#formatDetails > summary").click();
      if (step === "settings") {
        await page.locator('input[name="spacingMode"][value="custom"]').check({ force: true });
        await page.locator(".settings-card details").evaluateAll((details) => {
          for (const item of details) item.open = true;
        });
      }
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

test("対応表を開くと選択形式の記法を確認でき、サンプルも変換できる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "変換を始める" }).click();
  await expect(page.locator("#formatHelp")).toBeHidden();
  await page.locator("#format").selectOption("pixiv");
  await page.locator("#formatDetails > summary").click();
  await expect(page.locator("#formatHelp")).toBeVisible();
  await expect(page.locator("#formatHelp")).toContainText("[chapter:");
  await page.locator("#sample").click();
  await expect(page.locator("#source")).toHaveValue(/\[chapter:/);
  await expect(page.locator("#preview h1").first()).toBeVisible();
});

test("スマホの数値ボタンは押せる大きさを保ち、空行数を範囲内で変更できる", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: "変換を始める" }).click();
  await page.locator('[data-step-target="settings"]').click();
  const increase = page.getByRole("button", { name: "前の空行を増やす", exact: true });
  const decrease = page.getByRole("button", { name: "前の空行を減らす", exact: true });
  for (const button of [increase, decrease]) {
    const box = await button.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await increase.click();
  await expect(page.locator("#allBefore")).toHaveValue("1");
  await decrease.click();
  await decrease.click();
  await expect(page.locator("#allBefore")).toHaveValue("0");
  await page.locator("#allBefore").fill("10");
  await increase.click();
  await expect(page.locator("#allBefore")).toHaveValue("10");
});

test("「使い方」ダイアログが開き、PCとスマホの手順を切り替えられる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "変換を始める" }).first().click();
  await page.locator("#openHelp").click();
  await expect(page.locator("#helpDialog")).toBeVisible();
  // デスクトップ判定なので PC の手順が先に出る
  await expect(page.locator("#helpPc")).toBeVisible();
  await page.locator("#helpTabMobile").click();
  await expect(page.locator("#helpMobile")).toBeVisible();
  await expect(page.locator("#helpPc")).toBeHidden();
  await page.locator("#closeHelp").click();
  await expect(page.locator("#helpDialog")).toBeHidden();
});
