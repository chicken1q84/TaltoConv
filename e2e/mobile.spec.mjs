import { test, expect, devices } from "@playwright/test";

// 計画書 Phase B: タッチ端末での入力方法の見せ方と、iPad 縦向きの工程表示を確認します。
// 実機の代わりにデバイスエミュレーションを使うため、UA・タッチ点数・画面幅だけを再現しています。
// defaultBrowserType を外すのは、describe 内の test.use でブラウザ種別を変えられない（Chromium と WebKit の両方で走らせる）ためです。
const emulate = (name) => { const { defaultBrowserType, ...rest } = devices[name]; return rest; };

test.describe("iPhone エミュレーション", () => {
  test.use(emulate("iPhone 13"));

  test("フォルダ選択に「PC向け」が付き、代替手段の案内が出る", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "変換を始める" }).first().click();
    await expect(page.locator("#folderModeLabel")).toHaveText("フォルダ（PC向け）");
    await page.locator('input[name="sourceMode"][value="folder"]').check({ force: true });
    await expect(page.locator("#folderTouchNote")).toBeVisible();
    await expect(page.locator("#folderTouchNote")).toContainText("「ファイル」から複数");
  });

  test("ホームの端末別案内は iPhone が先頭で開く", async ({ page }) => {
    await page.goto("/");
    const first = page.locator(".device-item").first();
    await expect(first).toHaveAttribute("data-device", "iphone");
    await expect(first).toHaveAttribute("open", "");
  });

  test("貼り付け案内は長押し→ペースト", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#pasteHintText")).toContainText("長押し");
    await expect(page.locator("#pasteHintText")).toContainText("ペースト");
  });
});

test.describe("iPad 縦向きエミュレーション", () => {
  test.use(emulate("iPad (gen 7)"));

  test("縦向きは工程表示（カードを1つずつ）になる", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "変換を始める" }).first().click();
    await expect(page.locator(".mobile-tabs")).toBeVisible();
    await expect(page.locator(".format-card")).toBeHidden();
    await expect(page.locator(".source-card")).toBeVisible();
  });
});

test.describe("iPad 横向きエミュレーション", () => {
  test.use(emulate("iPad (gen 7) landscape"));

  test("横向きは PC と同じ2カラム", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "変換を始める" }).first().click();
    await expect(page.locator(".mobile-tabs")).toBeHidden();
    await expect(page.locator(".format-card")).toBeVisible();
    await expect(page.locator(".result-card")).toBeVisible();
  });
});

test("PC でもフォルダ選択の表記は変わらない", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "変換を始める" }).first().click();
  await expect(page.locator("#folderModeLabel")).toHaveText("フォルダ");
  await expect(page.locator("#folderTouchNote")).toBeHidden();
});
