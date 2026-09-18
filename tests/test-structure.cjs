// 配布時に起きやすい「ファイルはあるのにHTMLから読めない」を検出するテストです。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// ソースでは TaltoConv.html がこのフォルダの1つ上（root）にあります。
// ZIP版の検査では、ビルドが引数で TaltoConv_files/ を渡します。その場合 HTML はさらに1つ上の最上位にあるため、両方を探します。
const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, "..");
const htmlCandidates = [path.join(root, "TaltoConv.html"), path.join(root, "..", "TaltoConv.html")];
const htmlPath = htmlCandidates.find((candidate) => fs.existsSync(candidate));
assert.ok(htmlPath, "TaltoConv.html が見つかりません");
const html = fs.readFileSync(htmlPath, "utf8");
const catalog = require(path.join(root, "src", "scripts", "format-catalog.js"));
// 配布物は「動く」だけでなく「余計なものが入っていない」ことも確認します（テスト・設計資料・開発用ツールは同梱しない）。
if (process.argv[2]) {
  for (const extra of ["tests", "docs", "tools", "e2e", "node_modules"]) {
    assert.ok(!fs.existsSync(path.join(root, extra)), `配布物に ${extra}/ は同梱しません`);
  }
}
// ZIP版では HTML から見た src/ の位置が TaltoConv_files/src/ になります。参照の前置きはそれに合わせます。
const isLayered = path.dirname(htmlPath) !== root;
const assetPrefix = isLayered ? `${path.basename(root)}/` : "";

// HTMLの参照と実ファイルの存在を同時に確認します。
for (const asset of [
  "src/styles/app.css",
  "src/scripts/converter.js",
  "src/scripts/format-catalog.js",
  "src/scripts/settings-schema.js",
  "src/scripts/app.js",
]) {
  assert.ok(html.includes(`"${assetPrefix}${asset}"`), `HTMLに ${assetPrefix}${asset} の参照が必要です`);
  assert.ok(fs.existsSync(path.join(root, asset)), `${asset} が存在する必要があります`);
}

// 形式選択肢を変えた際、説明カタログの更新漏れを検出します。
for (const format of ["text", "commonmark", "gfm", "obsidian", "pixiv", "html"]) {
  assert.ok(catalog.descriptions[format], `${format} の形式定義が必要です`);
  assert.ok(catalog.descriptions[format].identifiers.length > 0, `${format} の識別子一覧が必要です`);
}

// 画面案内と実際のinput受付範囲がずれないよう、対応拡張子を固定します。
for (const extension of [".md", ".markdown", ".html", ".htm", ".txt"]) {
  assert.ok(html.includes(extension), `画面に対応拡張子 ${extension} の案内が必要です`);
}
assert.ok(html.includes("HTML拡張子とその他の原稿ファイルが混在しています"));
assert.ok(!html.includes("MarkdownとHTMLが混在しています"));

// ビルドがバージョンを埋め込む meta と、Web版の更新案内の部品が HTML にあることを固定します。
assert.ok(/<meta name="app-version" content="[^"]+">/.test(html), "app-version の meta が必要です");
for (const id of ["appVersion", "updateNotice", "reloadForUpdate"]) {
  assert.ok(html.includes(`id="${id}"`), `HTMLに id="${id}" が必要です`);
}

console.log("Structure checks passed.");
