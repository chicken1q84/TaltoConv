import { readFile, writeFile, mkdir, rm, copyFile, cp, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve, join, relative, sep } from "node:path";
import { deflateRawSync, deflateSync, crc32 } from "node:zlib";
import { Script } from "node:vm";

// このファイルは配布物を組み立てる配布係です。日常の変換処理には関与しません。
// 同じソースから次の3つを同時に作り、片方だけ更新された状態を作らないようにします。
//   ZIP版（BOOTH向け）      release/非公式TALTO移行ヘルパー_v<版>/ と同名の zip
//                            分割ファイル版HTML・単一ファイル版HTML・ソース・テスト・設計資料を同梱
//   Web版（GitHub Pages向け） dist/  index.html・manifest・Service Worker・アイコン
//
// 手順:
//   1. ソース側でテストを実行し、壊れた状態を配らないようにする
//   2. VERSION.txt を読み、HTML・manifest・Service Worker・zip名へ同じ値を埋め込む
//   3. HTMLからCSS・JavaScriptへの参照が欠けていないか確認する
//   4. dist/ と配布フォルダを作る
//   5. コピー先で構造テストを実行し、TALTO復元コードなど含めてはいけないものが混入していないか検査する
//   6. zip を作る（外部ツール不要。Node.js 22以降が必要）
//
// 使い方: node tools/build-release.mjs [--web-only]
//   --web-only  dist/ だけを作る。GitHub Actions ではこちらを使う（release/ はリポジトリの外にあるため）。
const root = resolve(import.meta.dirname, "..");
const webOnly = process.argv.includes("--web-only");
const version = await readVersion();
const packageName = `非公式TALTO移行ヘルパー_v${version}`;
const releaseRoot = resolve(root, "..", "release");
const packageDir = resolve(releaseRoot, packageName);
const zipPath = `${packageDir}.zip`;
const distDir = resolve(root, "dist");
const buildTime = new Date();

// 配布物に絶対に入れてはいけないフォルダ名です。作業フォルダ直下にある TALTO の復元コードや
// 個人の通信記録が、コピー範囲の指定ミスで紛れ込んだ場合に止めます。
const forbiddenSegments = new Set(["app", "vendor", "project-capture", "_maps", "deployed", "live-assets", "node_modules", ".git"]);
const forbiddenExtensions = new Set([".har"]);

/**
 * VERSION.txt の1行目をバージョンとして使います。
 * zip 名・画面表示・キャッシュ名に使うため、想定外の文字を含む値は受け付けません。
 */
async function readVersion() {
  const raw = (await readFile(resolve(root, "VERSION.txt"), "utf8")).split(/\r?\n/)[0].trim();
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(raw)) {
    throw new Error(`VERSION.txt の値が想定外です（例: 1.0.0 や 1.0.0-dev）: ${raw}`);
  }
  return raw;
}

/**
 * テストファイルを1つずつ別プロセスで実行します。
 * 1つでも失敗（終了コード0以外）なら、配布物を作らずに止めます。
 */
function runTests(baseDir, files) {
  for (const file of files) {
    console.log(`> node ${file}`);
    const result = spawnSync(process.execPath, [join(baseDir, file)], { cwd: baseDir, stdio: "inherit" });
    if (result.status !== 0) {
      throw new Error(`テストが失敗したため配布物を作成しません: ${file}`);
    }
  }
}

/**
 * フォルダ内のすべてのファイルを、「/」区切りの相対パスと共に集めます。
 * 並び順を固定し、同じ内容から同じ順序の zip と precache 一覧ができるようにします。
 */
async function collectFiles(baseDir) {
  const entries = await readdir(baseDir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const absolute = join(entry.parentPath, entry.name);
      return { absolute, name: relative(baseDir, absolute).split(sep).join("/") };
    })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * 配布物に含めてはいけないファイルが混入していないか検査します。
 * フォルダ名の一致で判定するため、`src/scripts/app.js` のようなファイル名は対象になりません。
 */
async function assertNoForbiddenFiles(baseDir, label) {
  const files = await collectFiles(baseDir);
  for (const file of files) {
    const segments = file.name.split("/");
    const directories = segments.slice(0, -1);
    const bad = directories.find((segment) => forbiddenSegments.has(segment));
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (bad || forbiddenExtensions.has(extension)) {
      throw new Error(`${label} に含めてはいけないファイルがあります: ${file.name}`);
    }
  }
  return files;
}

// ---- PNG アイコンの生成 ----
// 画像ツールに依存せず、単色の角丸四角と「TC」の字を描いた PNG を作ります。
// 正式な絵柄に差し替える場合は tools/pwa/icons/ に PNG を置き、buildIcons() を差し替えてください。

/** PNG のチャンク（長さ・種類・データ・CRC）を組み立てます。 */
function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])) >>> 0, 0);
  return Buffer.concat([length, typeBytes, data, checksum]);
}

/**
 * RGBA のピクセル配列を PNG へ変換します。各行の先頭にフィルター種別 0（なし）を置きます。
 */
function encodePng(size, pixels) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;   // ビット深度
  header[9] = 6;   // カラータイプ RGBA
  header[10] = 0; header[11] = 0; header[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

/**
 * アイコンを1枚描きます。文字は「TC」（Talto_Converter）です。
 * TALTO 本体のアイコンと紛らわしくならないよう、単独の「T」は使いません。
 * maskable は OS 側で丸や角丸に切り抜かれる前提なので、背景を全面に塗り、字を中央 70% に収めます。
 */
function drawIcon(size, { maskable = false } = {}) {
  const pixels = Buffer.alloc(size * size * 4);
  const background = [0x65, 0x51, 0x81];
  const radius = maskable ? 0 : size * 0.22;
  const glyphScale = maskable ? 0.7 : 0.9;
  const center = size / 2;
  // アイコン中心を原点とした比率で字形を定義します。左に「T」、右に「C」。
  const tBar = { x0: -0.44, x1: -0.06, y0: -0.22, y1: -0.10 };
  const tStem = { x0: -0.31, x1: -0.19, y0: -0.10, y1: 0.22 };
  const c = { cx: 0.24, cy: 0.0, outer: 0.22, inner: 0.105, gapDegrees: 42 };
  const inRect = (rect, nx, ny) => nx >= rect.x0 && nx <= rect.x1 && ny >= rect.y0 && ny <= rect.y1;
  const inC = (nx, ny) => {
    const dx = nx - c.cx;
    const dy = ny - c.cy;
    const distance = Math.hypot(dx, dy);
    if (distance > c.outer || distance < c.inner) return false;
    // 右側（角度0°付近）を切り欠いて C の開口部にします。
    const angle = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
    return angle > c.gapDegrees;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      // 角丸の外側は透明にします。
      const dx = Math.max(radius - x - 0.5, x + 0.5 - (size - radius), 0);
      const dy = Math.max(radius - y - 0.5, y + 0.5 - (size - radius), 0);
      if (radius && dx * dx + dy * dy > radius * radius) continue;
      const nx = ((x + 0.5) - center) / (size * glyphScale);
      const ny = ((y + 0.5) - center) / (size * glyphScale);
      const white = inRect(tBar, nx, ny) || inRect(tStem, nx, ny) || inC(nx, ny);
      pixels[offset] = white ? 0xff : background[0];
      pixels[offset + 1] = white ? 0xff : background[1];
      pixels[offset + 2] = white ? 0xff : background[2];
      pixels[offset + 3] = 0xff;
    }
  }
  return encodePng(size, pixels);
}

async function buildIcons(targetDir) {
  await mkdir(targetDir, { recursive: true });
  await Promise.all([
    writeFile(resolve(targetDir, "icon-192.png"), drawIcon(192)),
    writeFile(resolve(targetDir, "icon-512.png"), drawIcon(512)),
    writeFile(resolve(targetDir, "icon-maskable-512.png"), drawIcon(512, { maskable: true })),
    writeFile(resolve(targetDir, "apple-touch-icon.png"), drawIcon(180, { maskable: true }))
  ]);
}

// ---- zip の生成 ----

/** zip形式が要求する「MS-DOS形式」の時刻と日付へ変換します。秒は2秒単位です。 */
function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

/**
 * 依存パッケージやOS付属ツールを使わず、zipファイルを組み立てます。
 * 日本語のフォルダ名を各OSで正しく展開できるよう、ファイル名はUTF-8フラグ付きで記録します。
 * 圧縮して小さくならないファイルは、無圧縮のまま格納します。
 */
async function buildZip(baseDir, folderName) {
  const files = await collectFiles(baseDir);
  const { time, day } = dosDateTime(buildTime);
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const file of files) {
    const data = await readFile(file.absolute);
    const nameBytes = Buffer.from(`${folderName}/${file.name}`, "utf8");
    const checksum = crc32(data);
    const deflated = deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const method = useDeflate ? 8 : 0;
    const body = useDeflate ? deflated : data;

    // ローカルファイルヘッダー（各ファイルの直前に置く見出し）
    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);        // 展開に必要なzip仕様バージョン 2.0
    local.writeUInt16LE(0x0800, 6);    // ファイル名がUTF-8であることを示すフラグ
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    nameBytes.copy(local, 30);

    // セントラルディレクトリ（zip末尾にまとめて置く目次）
    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);      // 拡張フィールドなし
    central.writeUInt16LE(0, 32);      // コメントなし
    central.writeUInt16LE(0, 34);      // 分割zipではない
    central.writeUInt16LE(0, 36);      // 内部属性なし
    central.writeUInt32LE(0, 38);      // 外部属性なし（OS依存の権限を持ち込まない）
    central.writeUInt32LE(offset, 42);
    nameBytes.copy(central, 46);

    localParts.push(local, body);
    centralParts.push(central);
    offset += local.length + body.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return { buffer: Buffer.concat([...localParts, centralDirectory, end]), count: files.length };
}

// ---- HTML の加工 ----

const stylesheetTag = '<link rel="stylesheet" href="src/styles/app.css">';
const scriptFiles = ["src/scripts/converter.js", "src/scripts/format-catalog.js", "src/scripts/app.js"];
const versionMetaTag = '<meta name="app-version" content="dev">';

/**
 * 参照が欠けたHTMLを配らないために、ビルド前に必須の参照とバージョン欄を確認します。
 */
function assertSourceHtml(html) {
  const required = [stylesheetTag, ...scriptFiles.map((file) => `<script src="${file}"></script>`), versionMetaTag];
  for (const fragment of required) {
    if (!html.includes(fragment)) throw new Error(`HTMLに必要な記述がありません: ${fragment}`);
  }
}

/** VERSION.txt の値を画面表示用の meta へ埋め込みます。 */
function withVersion(html) {
  return html.replace(versionMetaTag, `<meta name="app-version" content="${version}">`);
}

/** <html> に版の種類を記録し、画面側が Web版・単一ファイル版を見分けられるようにします。 */
function withBuildKind(html, kind) {
  return html.replace('<html lang="ja">', `<html lang="ja" data-build="${kind}">`);
}

/**
 * CSS と JavaScript を HTML へ埋め込み、1ファイルで完結する版を作ります。
 * 読み込み順は分割版と同じです（変換→形式カタログ→画面制御）。
 */
async function buildSingleFileHtml(html) {
  const css = await readFile(resolve(root, "src/styles/app.css"), "utf8");
  // 置換文字列に "$&" などが含まれると String.replace が特別扱いするため、関数で返して素通しします。
  let output = html.replace(stylesheetTag, () => `<style>\n${css}\n</style>`);
  for (const file of scriptFiles) {
    const code = await readFile(resolve(root, file), "utf8");
    if (code.includes("</script")) throw new Error(`${file} に </script が含まれるため単一ファイル化できません。`);
    output = output.replace(`<script src="${file}"></script>`, () => `<script>\n${code}\n</script>`);
  }
  // 埋め込み後のスクリプトが構文的に壊れていないか、ブラウザなしで確認します（埋め込み時の文字化けや置換ミスの検出）。
  for (const [, inline] of output.matchAll(/<script>\n([\s\S]*?)\n<\/script>/g)) {
    try { new Script(inline); } catch (error) { throw new Error(`単一ファイル版の埋め込みスクリプトに構文エラーがあります: ${error.message}`); }
  }
  return withBuildKind(output, "single");
}

/** Web版に必要な manifest・アイコン・ホーム画面追加用の meta を head の末尾へ差し込みます。 */
function buildWebHtml(html) {
  const head = [
    '  <link rel="manifest" href="manifest.webmanifest">',
    '  <link rel="apple-touch-icon" href="icons/apple-touch-icon.png">',
    '  <link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">',
    '  <meta name="mobile-web-app-capable" content="yes">',
    '  <meta name="apple-mobile-web-app-capable" content="yes">',
    '  <meta name="apple-mobile-web-app-status-bar-style" content="default">',
    '  <meta name="apple-mobile-web-app-title" content="Talto_Converter">'
  ].join("\n");
  return withBuildKind(html.replace("</head>", `${head}\n</head>`), "web");
}

// ================================================================
// ---- 1. ソース側のテスト ----
runTests(root, ["tests/test-converter.cjs", "tests/test-structure.cjs", "tests/fuzz-converter.cjs"]);

// ---- 2. HTML の読み込みとバージョン埋め込み ----
const sourceHtml = await readFile(resolve(root, "非公式TALTO移行ヘルパー.html"), "utf8");
assertSourceHtml(sourceHtml);
const versionedHtml = withVersion(sourceHtml);
console.log(`バージョン: ${version}`);

// ---- 3. Web版（dist/） ----
await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await Promise.all([
  writeFile(resolve(distDir, "index.html"), buildWebHtml(versionedHtml), "utf8"),
  cp(resolve(root, "src"), resolve(distDir, "src"), { recursive: true }),
  copyFile(resolve(root, "tools/pwa/manifest.webmanifest"), resolve(distDir, "manifest.webmanifest")),
  copyFile(resolve(root, "LICENSE.txt"), resolve(distDir, "LICENSE.txt")),
  buildIcons(resolve(distDir, "icons"))
]);
// Service Worker は最後に作ります。precache 一覧に dist/ の全ファイルを載せるためです。
const distFiles = await assertNoForbiddenFiles(distDir, "dist");
const precache = ["./", ...distFiles.map((file) => `./${file.name}`)];
const swTemplate = await readFile(resolve(root, "tools/pwa/sw.js"), "utf8");
await writeFile(
  resolve(distDir, "sw.js"),
  // 置き換え先は雛形の説明コメントにも現れるため、先頭1件ではなく全件を置き換えます。
  swTemplate.replaceAll("__VERSION__", version).replaceAll("__PRECACHE__", JSON.stringify(precache, null, 2)),
  "utf8"
);
console.log(`Web版: ${distDir} (${distFiles.length + 1}ファイル)`);

if (webOnly) {
  console.log("--web-only のため ZIP版は作成しません。");
} else {
  // ---- 4. ZIP版（release/） ----
  // 古い配布物が混ざらないよう、同名の出力先と zip だけを作り直します。他の版のフォルダは削除しません。
  await rm(packageDir, { recursive: true, force: true });
  await rm(zipPath, { force: true });
  await mkdir(packageDir, { recursive: true });

  // 改修する人が原因を追えるよう、実行ファイルだけでなくテストと設計資料も同梱します。
  await Promise.all([
    writeFile(resolve(packageDir, "非公式TALTO移行ヘルパー.html"), versionedHtml, "utf8"),
    buildSingleFileHtml(versionedHtml).then((html) => writeFile(resolve(packageDir, "非公式TALTO移行ヘルパー_単一ファイル版.html"), html, "utf8")),
    cp(resolve(root, "src"), resolve(packageDir, "src"), { recursive: true }),
    cp(resolve(root, "tests"), resolve(packageDir, "tests"), { recursive: true }),
    cp(resolve(root, "docs"), resolve(packageDir, "docs"), { recursive: true }),
    mkdir(resolve(packageDir, "tools"), { recursive: true }).then(() =>
      copyFile(resolve(root, "tools", "serve.mjs"), resolve(packageDir, "tools", "serve.mjs"))
    ),
    copyFile(resolve(root, "tools", "templates", "README-DEBUG.txt"), resolve(packageDir, "README.txt")),
    copyFile(resolve(root, "CHANGELOG.txt"), resolve(packageDir, "CHANGELOG.txt")),
    copyFile(resolve(root, "LICENSE.txt"), resolve(packageDir, "LICENSE.txt")),
    copyFile(resolve(root, "VERSION.txt"), resolve(packageDir, "VERSION.txt"))
  ]);

  // ---- 5. 配布物側の検査 ----
  // コピー先で実行することで、「ソースでは動くが配布物では欠けている」を検出します。
  runTests(packageDir, ["tests/test-structure.cjs"]);
  await assertNoForbiddenFiles(packageDir, "ZIP版");

  // ---- 6. zip の作成 ----
  const zip = await buildZip(packageDir, packageName);
  await writeFile(zipPath, zip.buffer);
  console.log(`配布フォルダ: ${packageDir}`);
  console.log(`zip (${zip.count}ファイル, ${(zip.buffer.length / 1024).toFixed(1)}KB): ${zipPath}`);
}
