import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

// 設定ファイルの保存と読込。保存したファイルがそのまま検査に通ること（往復の整合）と、
// 壊れたファイルを読み込んでも既存の設定が変わらないことを確認します。

async function importText(page, text) {
  await page.locator("#importSettings").setInputFiles({ name: "settings.txt", mimeType: "text/plain", buffer: Buffer.from(text, "utf8") });
}

test("保存した設定ファイルは、そのまま読み込める", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "変換を始める" }).first().click();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#exportSettings").click();
  const download = await downloadPromise;
  const saved = readFileSync(await download.path(), "utf8");
  const problems = await page.evaluate((text) => window.TaltoSettingsSchema.validate(JSON.parse(text)), saved);
  expect(problems).toEqual([]);
  await importText(page, saved);
  await expect(page.locator("#settingsFileFeedback")).toContainText("適用しました");
});

test("書式に合わない設定ファイルは理由を表示し、設定を変えない", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "変換を始める" }).first().click();
  // 種類別の欄はカスタム設定のときだけ表示されるため、先に切り替えます。
  await page.locator('input[name="spacingMode"][value="custom"]').check({ force: true });
  await page.locator("#h1Before").fill("2");
  await importText(page, JSON.stringify({ app: "unofficial-talto-migration-helper", version: 2, values: { h1Before: "たくさん" }, mode: "auto" }));
  const feedback = page.locator("#settingsFileFeedback");
  await expect(feedback).toContainText("書式に合わない項目が2件");
  await expect(feedback).toContainText("values.h1Before は 0〜10 の整数");
  await expect(feedback).toContainText("mode は unified・custom");
  await expect(feedback).toHaveClass(/error/);
  await expect(page.locator("#h1Before")).toHaveValue("2");
});

test("JSON として壊れたファイルは日本語で案内する", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "変換を始める" }).first().click();
  await importText(page, '{ "app": "x", ');
  await expect(page.locator("#settingsFileFeedback")).toContainText("書式（JSON）が壊れています");
});
