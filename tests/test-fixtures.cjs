// 共通テスト原稿（tests/fixtures/common-manuscript.md）を既定設定で変換し、
// 期待出力（同 .expected.html / .expected.txt）と完全一致することを確認します。
// 変換規則を意図して変えたときは、`node tests/test-fixtures.cjs --update` で期待出力を作り直し、差分を目視で確認してからコミットします。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const fixtureDir = path.join(__dirname, "fixtures");
const manuscript = fs.readFileSync(path.join(fixtureDir, "common-manuscript.md"), "utf8");
const expectedHtmlPath = path.join(fixtureDir, "common-manuscript.expected.html");
const expectedTextPath = path.join(fixtureDir, "common-manuscript.expected.txt");

/**
 * 画面の初期設定と同じ内容です（app.js の options() と initializeDefaults に対応）。
 * 画面側の初期値を変えたときは、ここも合わせて変更します。
 */
const defaultSettings = {
  title: "", firstH1AsTitle: false, removeFirstHeading: false,
  includeLeadingSpacing: false, includeTrailingSpacing: false,
  italicAsNote: true, removeHorizontalRules: false,
  consecutiveHeadingSpacing: 0,
  boldHeadings: { h1: false, h2: false, h3: false },
  underlineBlocks: { h1: false, h2: false, h3: false, note: false, body: false },
  listMarker: "・ ",
  listPrefixBold: false, listPrefixUnderline: false, listContentBold: false, listContentUnderline: false,
  inlineMarkers: {},
  frontmatterStarts: [0],
  spacingMode: "unified",
  spacing: { h1: { before: 0, after: 0 }, h2: { before: 0, after: 0 }, h3: { before: 0, after: 0 }, note: { before: 0, after: 0 }, body: { before: 0, after: 0 } },
  markdownFlavor: "obsidian"
};

/** 指定した converter.js で共通原稿を変換します。配布物の一致テストからも使います。 */
function convertWith(converterPath) {
  const converter = require(converterPath);
  const result = converter.parseMarkdown(manuscript, defaultSettings);
  return { html: result.html, plainText: result.plainText };
}

const actual = convertWith(path.join(root, "src", "scripts", "converter.js"));

if (process.argv.includes("--update")) {
  fs.writeFileSync(expectedHtmlPath, actual.html, "utf8");
  fs.writeFileSync(expectedTextPath, actual.plainText, "utf8");
  console.log("期待出力を更新しました。差分を確認してからコミットしてください。");
} else {
  assert.ok(fs.existsSync(expectedHtmlPath), "期待出力がありません。node tests/test-fixtures.cjs --update で作成してください");
  assert.equal(actual.html, fs.readFileSync(expectedHtmlPath, "utf8"), "共通原稿のHTML出力が期待値と異なります");
  assert.equal(actual.plainText, fs.readFileSync(expectedTextPath, "utf8"), "共通原稿のテキスト出力が期待値と異なります");
  // 期待出力そのものの妥当性も最低限確認します（空や見出し欠落を「一致」で通さないため）。
  assert.match(actual.html, /<h1>共通テスト原稿<\/h1>/);
  assert.match(actual.html, /<h3>小見出し<\/h3>/);
  assert.match(actual.html, /<u>下線<\/u>/);
  assert.match(actual.html, /【画像：地図｜images\/map\.png】/);
  console.log("fixture checks passed: common manuscript matches expected output.");
}

module.exports = { convertWith, defaultSettings, manuscript };
