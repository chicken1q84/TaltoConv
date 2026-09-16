import { test, expect } from "@playwright/test";

// 計画書 Phase 3: 自動コピー → 予備経路 → 手動コピー欄 の順に進むことを確認します。
// 実機の iOS Safari とは挙動が異なるため、ここでは「失敗したときに手動コピーへ到達できる」構造を検査します。

async function openPreviewWithText(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "変換を始める" }).first().click();
  await page.locator("#source").fill("# 見出し\n\n本文です。**太字**も。");
  await page.evaluate(() => { document.body.dataset.step = "preview"; });
  await expect(page.locator("#copyResult")).toBeEnabled();
}

test("Clipboard API が拒否し execCommand も失敗すると、手動コピー欄が開く", async ({ page }) => {
  await openPreviewWithText(page);
  await page.evaluate(() => {
    const denied = () => Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
    Object.defineProperty(navigator, "clipboard", { value: { write: denied, writeText: denied }, configurable: true });
    document.execCommand = () => false;
  });
  await page.locator("#copyResult").click();
  await expect(page.locator("#manualCopy")).toBeVisible();
  await expect(page.locator("#manualCopyReason")).toContainText("許可しませんでした");
  await expect(page.locator("#manualCopyRich h1")).toHaveText("見出し");
  await expect(page.locator("#manualCopyText")).toBeHidden();
  await expect(page.locator("#copyFeedback")).toHaveClass(/error/);
});

test("Clipboard API がない環境では「使えません」の案内になる", async ({ page }) => {
  await openPreviewWithText(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    document.execCommand = () => false;
  });
  await page.locator("#copyResult").click();
  await expect(page.locator("#manualCopyReason")).toContainText("自動コピーを使えません");
});

test("書式なしテキストを選ぶと手動コピー欄はテキスト欄になり、すべて選択できる", async ({ page }) => {
  await openPreviewWithText(page);
  await page.locator("#copyFormat").selectOption("plain");
  await page.locator("#openManualCopy").click();
  await expect(page.locator("#manualCopy")).toBeVisible();
  await expect(page.locator("#manualCopyReason")).toBeHidden();
  await expect(page.locator("#manualCopyRich")).toBeHidden();
  await expect(page.locator("#manualCopyText")).toHaveValue(/見出し/);
  await page.locator("#selectManualCopy").click();
  const selected = await page.evaluate(() => {
    const area = document.getElementById("manualCopyText");
    return area.selectionEnd - area.selectionStart === area.value.length && area.value.length > 0;
  });
  expect(selected).toBe(true);
  await expect(page.locator("#manualCopyFeedback")).toContainText("選択しました");
});

test("手動コピー欄を開いたまま原稿を変えると内容が追従し、原稿を消すと閉じる", async ({ page }) => {
  await openPreviewWithText(page);
  await page.locator("#openManualCopy").click();
  await page.locator("#source").fill("# 別の見出し");
  await expect(page.locator("#manualCopyRich h1")).toHaveText("別の見出し");
  await page.locator("#source").fill("");
  await expect(page.locator("#manualCopy")).toBeHidden();
});

test("自動コピーが成功すると手動コピー欄は閉じ、成功メッセージが出る", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "クリップボード権限の付与は Chromium だけで扱う");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openPreviewWithText(page);
  await page.locator("#openManualCopy").click();
  await page.locator("#copyResult").click();
  await expect(page.locator("#copyFeedback")).toContainText("コピーしました");
  await expect(page.locator("#manualCopy")).toBeHidden();
  const html = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const blob = await items[0].getType("text/html");
    return blob.text();
  });
  expect(html).toContain("<h1");
});
