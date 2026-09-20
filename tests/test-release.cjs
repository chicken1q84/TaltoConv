// 配布物（Web版 dist/ と ZIP版 ../release/TaltoConv_v<版>/）の構造と、3つの版の変換結果が一致することを検査します。
// 配布物は tools/build-release.mjs が作るため、まだ無い場合は検査を省略して正常終了します
//（build-release.mjs は配布物を作った直後にこのテストを実行します）。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { convertWith } = require("./test-fixtures.cjs");

const root = path.resolve(__dirname, "..");
const version = fs.readFileSync(path.join(root, "VERSION.txt"), "utf8").split(/\r?\n/)[0].trim();
const distDir = path.join(root, "dist");
const packageDir = path.resolve(root, "..", "release", `TaltoConv_v${version}`);
const filesDirName = "TaltoConv_files";
const forbiddenSegments = new Set(["app", "vendor", "project-capture", "_maps", "deployed", "live-assets", "node_modules", ".git"]);

/** フォルダ内の全ファイルを「/」区切りの相対パスで列挙します。 */
function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"))
    .sort();
}

function assertNoForbidden(dir, label) {
  for (const file of listFiles(dir)) {
    const directories = file.split("/").slice(0, -1);
    assert.ok(!directories.some((segment) => forbiddenSegments.has(segment)), `${label} に含めてはいけないフォルダがあります: ${file}`);
    assert.ok(!file.toLowerCase().endsWith(".har"), `${label} に通信記録があります: ${file}`);
  }
}

/** HTML に埋め込まれたバージョンを取り出します。 */
function embeddedVersion(html) {
  return (html.match(/<meta name="app-version" content="([^"]+)">/) || [])[1];
}

/**
 * 単一ファイル版の HTML から、最初の <script> ブロック（converter.js）を取り出して一時ファイルに書き、require できるようにします。
 */
function extractInlineConverter(html) {
  const match = html.match(/<script>\n([\s\S]*?)\n<\/script>/);
  assert.ok(match, "単一ファイル版に埋め込みスクリプトがありません");
  const tempPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "taltoconv-")), "converter.js");
  fs.writeFileSync(tempPath, match[1], "utf8");
  return tempPath;
}

const sourceConverter = path.join(root, "src", "scripts", "converter.js");
const baseline = convertWith(sourceConverter);
let checked = 0;

// ---- Web版 ----
if (fs.existsSync(path.join(distDir, "index.html"))) {
  const html = fs.readFileSync(path.join(distDir, "index.html"), "utf8");
  assert.equal(embeddedVersion(html), version, "dist/index.html のバージョンが VERSION.txt と一致しません");
  assert.ok(html.includes('data-build="web"'), "dist/index.html に data-build=\"web\" が必要です");
  assert.ok(html.includes('rel="manifest"'), "dist/index.html に manifest の参照が必要です");
  for (const file of ["manifest.webmanifest", "sw.js", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "src/scripts/converter.js", "LICENSE.txt"]) {
    assert.ok(fs.existsSync(path.join(distDir, file)), `dist/${file} が必要です`);
  }
  const sw = fs.readFileSync(path.join(distDir, "sw.js"), "utf8");
  assert.ok(sw.includes(`const VERSION = "${version}";`), "sw.js のバージョンが VERSION.txt と一致しません");
  assert.match(sw, /const BUILD_ID = "[0-9a-f]{10}";/, "sw.js に BUILD_ID が必要です");
  const precache = JSON.parse(sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
  const distFiles = listFiles(distDir);
  for (const entry of precache) {
    if (entry === "./") continue;
    assert.ok(distFiles.includes(entry.replace(/^\.\//, "")), `sw.js の precache に無いファイルがあります: ${entry}`);
  }
  for (const file of distFiles) {
    if (file === "sw.js") continue;
    assert.ok(precache.includes(`./${file}`), `dist/${file} が precache に含まれていません（オフラインで欠けます）`);
  }
  assertNoForbidden(distDir, "dist");
  assert.equal(fs.readFileSync(path.join(distDir, "src/scripts/converter.js"), "utf8"), fs.readFileSync(sourceConverter, "utf8"), "dist の converter.js がソースと異なります");
  assert.deepEqual(convertWith(path.join(distDir, "src/scripts/converter.js")), baseline, "Web版の変換結果がソースと異なります");
  checked += 1;
  console.log(`release checks: Web版 OK (${distFiles.length} files, v${version})`);
} else {
  console.log("release checks: dist/ が無いため Web版の検査を省略");
}

// ---- ZIP版 ----
if (fs.existsSync(path.join(packageDir, "TaltoConv.html"))) {
  const filesDir = path.join(packageDir, filesDirName);
  const html = fs.readFileSync(path.join(packageDir, "TaltoConv.html"), "utf8");
  assert.equal(embeddedVersion(html), version, "ZIP版 TaltoConv.html のバージョンが VERSION.txt と一致しません");
  assert.ok(html.includes(`href="${filesDirName}/src/styles/app.css"`), "ZIP版の HTML は TaltoConv_files/src を参照する必要があります");
  assert.ok(!html.includes('href="src/'), "ZIP版の HTML に書き換え漏れの src/ 参照があります");
  // 最上位は「クリックするファイル」と説明書だけ
  const topLevel = fs.readdirSync(packageDir).sort();
  assert.deepEqual(topLevel, ["TaltoConv.html", filesDirName, "はじめにお読みください.txt"].sort(), `ZIP版の最上位に余分なものがあります: ${topLevel.join(", ")}`);
  for (const file of ["TaltoConv_単一ファイル版.html", "VERSION.txt", "CHANGELOG.txt", "LICENSE.txt", "src/scripts/converter.js"]) {
    assert.ok(fs.existsSync(path.join(filesDir, file)), `ZIP版に ${filesDirName}/${file} が必要です`);
  }
  // 利用者に不要なものは入れない（テスト・設計資料・開発用ツール）
  const filesTopLevel = fs.readdirSync(filesDir).sort();
  assert.deepEqual(filesTopLevel, ["CHANGELOG.txt", "LICENSE.txt", "TaltoConv_単一ファイル版.html", "VERSION.txt", "src"].sort(), `ZIP版の ${filesDirName}/ に余分なものがあります: ${filesTopLevel.join(", ")}`);
  assert.equal(fs.readFileSync(path.join(filesDir, "VERSION.txt"), "utf8").trim(), version, "ZIP版の VERSION.txt が一致しません");
  assertNoForbidden(packageDir, "ZIP版");
  const single = fs.readFileSync(path.join(filesDir, "TaltoConv_単一ファイル版.html"), "utf8");
  assert.equal(embeddedVersion(single), version, "単一ファイル版のバージョンが一致しません");
  assert.ok(single.includes('data-build="single"'), "単一ファイル版に data-build=\"single\" が必要です");
  assert.ok(!/<script src=|<link rel="stylesheet" href=/.test(single), "単一ファイル版に外部参照が残っています");
  assert.deepEqual(convertWith(path.join(filesDir, "src/scripts/converter.js")), baseline, "ZIP版の変換結果がソースと異なります");
  assert.deepEqual(convertWith(extractInlineConverter(single)), baseline, "単一ファイル版の変換結果がソースと異なります");
  checked += 1;
  console.log(`release checks: ZIP版 OK (v${version})`);
} else {
  console.log("release checks: ZIP版の配布フォルダが無いため検査を省略");
}

if (checked === 2) console.log("release checks passed: 3つの版の変換結果が一致しています。");
