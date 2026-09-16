import { readFile, writeFile, mkdir, rm, copyFile, cp, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve, join, relative } from "node:path";
import { deflateRawSync, crc32 } from "node:zlib";

// このファイルは「改修デバッグ版」だけを組み立てる配布係です。
// 日常の変換処理には関与せず、次の順で配布物を作ります。
//   1. ソース側でテストを実行し、壊れた状態を配らないようにする
//   2. HTMLからCSS・JavaScriptへの参照が欠けていないか確認する
//   3. 公開用フォルダへ実行ファイル・テスト・設計資料をコピーする
//   4. コピー先で構造テストを実行し、配布物そのものが起動できることを確かめる
//   5. 同名のzipを作る（外部ツール不要。Node.js 22以降が必要）
//
// 使い方: node tools/build-debug-package.mjs [YYYY-MM-DD]
//   日付を省略すると、実行したPCのローカル日付を配布名に使います。
const root = resolve(import.meta.dirname, "..");
const releaseRoot = resolve(root, "..", "release");
const releaseDate = resolveReleaseDate(process.argv[2]);
const packageName = `非公式TALTO移行ヘルパー_改修デバッグ版_${releaseDate}`;
const packageDir = resolve(releaseRoot, packageName);
const zipPath = `${packageDir}.zip`;
const buildTime = new Date();

/**
 * 配布名に使う日付を決めます。引数がなければ本日（ローカル時刻）です。
 * 桁がそろっていない日付は、フォルダ名の並び順が崩れるため受け付けません。
 */
function resolveReleaseDate(argument) {
  if (argument === undefined) {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(argument)) {
    throw new Error(`日付は YYYY-MM-DD 形式で指定してください: ${argument}`);
  }
  return argument;
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
 * フォルダ内のすべてのファイルを、zip内で使う「/」区切りの相対パスと共に集めます。
 * 並び順を固定し、同じ内容から同じ順序のzipができるようにします。
 */
async function collectFiles(baseDir) {
  const entries = await readdir(baseDir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const absolute = join(entry.parentPath, entry.name);
      return { absolute, name: relative(baseDir, absolute).split("\\").join("/") };
    })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * zip形式が要求する「MS-DOS形式」の時刻と日付へ変換します。秒は2秒単位です。
 */
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

// ---- 1. ソース側のテスト ----
runTests(root, ["tests/test-converter.cjs", "tests/test-structure.cjs", "tests/fuzz-converter.cjs"]);

// ---- 2. HTMLの参照検査 ----
// 参照が欠けたHTMLを配らないために確認します。
const html = await readFile(resolve(root, "非公式TALTO移行ヘルパー.html"), "utf8");
if (!html.includes('href="src/styles/app.css"')
  || !html.includes('src="src/scripts/converter.js"')
  || !html.includes('src="src/scripts/format-catalog.js"')
  || !html.includes('src="src/scripts/app.js"')) {
  throw new Error("HTMLからCSSまたはJavaScriptへの参照を確認できません。");
}

// ---- 3. 配布フォルダの作成 ----
// 古い配布物が混ざらないよう、同名の出力先とzipだけを作り直します。
// ソース本体や、ほかの日付のリリースフォルダは削除しません。
await rm(packageDir, { recursive: true, force: true });
await rm(zipPath, { force: true });
await mkdir(packageDir, { recursive: true });

// 改修する人が原因を追えるよう、実行ファイルだけでなくテストと設計資料も同梱します。
await Promise.all([
  writeFile(resolve(packageDir, "非公式TALTO移行ヘルパー.html"), html, "utf8"),
  cp(resolve(root, "src"), resolve(packageDir, "src"), { recursive: true }),
  cp(resolve(root, "tests"), resolve(packageDir, "tests"), { recursive: true }),
  cp(resolve(root, "docs"), resolve(packageDir, "docs"), { recursive: true }),
  mkdir(resolve(packageDir, "tools"), { recursive: true }).then(() =>
    copyFile(resolve(root, "tools", "serve.mjs"), resolve(packageDir, "tools", "serve.mjs"))
  ),
  copyFile(resolve(root, "tools", "templates", "README-DEBUG.txt"), resolve(packageDir, "README.txt"))
]);

// ---- 4. 配布物側の検査 ----
// コピー先で実行することで、「ソースでは動くが配布物では欠けている」を検出します。
runTests(packageDir, ["tests/test-structure.cjs"]);

// ---- 5. zipの作成 ----
const zip = await buildZip(packageDir, packageName);
await writeFile(zipPath, zip.buffer);

// 自動処理や人間が出力場所を見つけやすいよう、最後に絶対パスを表示します。
console.log(`配布フォルダ: ${packageDir}`);
console.log(`zip (${zip.count}ファイル, ${(zip.buffer.length / 1024).toFixed(1)}KB): ${zipPath}`);
