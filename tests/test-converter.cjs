// 実際の仕様を小さな例で固定する回帰テストです。
// 失敗した行を見ると、どの表示規則が変わったか追跡できます。
const assert = require("node:assert/strict");
const converter = require("../src/scripts/converter.js");

// 容量制限：境界値ちょうどは許可し、1バイト超過は拒否します。
assert.equal(converter.checkImportSize([{ name: "a.md", size: 10 * 1024 * 1024 }], "files").allowed, true);
assert.equal(converter.checkImportSize([{ name: "large.md", size: 10 * 1024 * 1024 + 1 }], "files").allowed, false);
assert.equal(converter.checkImportSize([{ name: "a.md", size: 60 * 1024 * 1024 }, { name: "b.md", size: 40 * 1024 * 1024 }], "folder").allowed, true);
assert.equal(converter.checkImportSize([{ name: "a.md", size: 100 * 1024 * 1024 + 1 }], "folder").allowed, false);
const overriddenSize = converter.checkImportSize([{ name: "large.md", size: 11 * 1024 * 1024 }], "files", true);
assert.equal(overriddenSize.allowed, true);
assert.equal(overriddenSize.exceeded, true);

const markdown = `# 冊子名

## 見出し

通常の **太字** と *斜体*。

> 注釈1
> 注釈2

- 項目A
1. 項目B

![地図](images/map.png)
`;

const result = converter.parseMarkdown(markdown, { firstH1AsTitle: true });
assert.equal(result.title, "冊子名");
assert.match(result.html, /<h2>見出し<\/h2>/);
assert.match(result.html, /<strong>太字<\/strong>/);
assert.match(result.html, /と 斜体。/);
assert.ok(!result.html.includes("<em>"));
assert.match(result.html, /<blockquote>注釈1<br>注釈2<\/blockquote>/);
assert.match(result.html, /<p>・&nbsp;項目A<\/p>/);
assert.match(result.html, /<p>1\.&nbsp;項目B<\/p>/);
assert.match(result.html, /【画像：地図｜images\/map\.png】/);
assert.equal(result.images.length, 1);
assert.ok(result.warnings.some((warning) => warning.includes("画像ファイルは読み込まず")));
assert.ok(!result.html.includes("<script"));

const escaped = converter.parseMarkdown("<script>alert(1)</script>");
assert.match(escaped.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);

const configured = converter.parseMarkdown(
  "# 設定例\n\n## 見出し\n\n*これは注釈*\n\n---\n\n本文",
  {
    firstH1AsTitle: true,
    removeFirstHeading: true,
    italicAsNote: true,
    removeHorizontalRules: true,
    headingBlankLinesBefore: 2,
    headingBlankLinesAfter: 1,
  }
);
assert.equal(configured.title, "設定例");
assert.equal((configured.html.match(/<p><\/p>/g) || []).length, 3);
assert.ok(!configured.html.includes("<p><br></p>"));
assert.match(configured.html, /<blockquote>これは注釈<\/blockquote>/);
assert.ok(!configured.html.includes("──────────"));
assert.ok(configured.warnings.some((warning) => warning.includes("区切り線を1件削除")));

const italicSimplified = converter.parseMarkdown("*斜体は通常文字*", { italicAsNote: false });
assert.equal(italicSimplified.html, "<p>斜体は通常文字</p>");
const strikeSimplified = converter.parseMarkdown("~~打消しは通常文字~~");
assert.equal(strikeSimplified.html, "<p>打消しは通常文字</p>");

const blank = "<p></p>";
const unified = converter.parseMarkdown("段落A\n\n段落B", {
  spacingMode: "unified", spacing: { all: { before: 1, after: 1 } }
});
assert.equal(unified.html, ["<p>段落A</p>", blank, "<p>段落B</p>"].join("\n"));
assert.equal(unified.plainText, "段落A\n\n段落B");

const customOptions = {
  spacingMode: "custom",
  spacing: {
    h1: { before: 1, after: 2 }, h2: { before: 3, after: 1 },
    h3: { before: 0, after: 2 }, note: { before: 4, after: 0 }, body: { before: 1, after: 3 }
  },
  boldHeadings: { h2: true }, removeHorizontalRules: true, removeFirstHeading: true
};
const custom = converter.parseMarkdown("# タイトル\n\n# H1\n\n## H2\n\n### H3\n\n*注釈*\n\n---\n\n本文", customOptions);
const expectedBlocks = ["<h1>H1</h1>", ...Array(3).fill(blank), "<h2><strong>H2</strong></h2>",
  blank, "<h3>H3</h3>", ...Array(4).fill(blank), "<blockquote>注釈</blockquote>", blank, "<p>本文</p>"];
assert.equal(custom.title, "");
assert.equal(custom.html, expectedBlocks.join("\n"));
assert.equal(custom.plainText, "H1\n\n\n\nH2\n\nH3\n\n\n\n\n注釈\n\n本文");

const bold = converter.parseMarkdown("# H1\n\n## H2\n\n### H3\n\n本文 **元の太字**", {
  firstH1AsTitle: false, boldHeadings: { h1: true, h2: true, h3: true }
});
for (const level of [1, 2, 3]) assert.ok(bold.html.includes(`<h${level}><strong>H${level}</strong></h${level}>`));
assert.ok(bold.html.includes("本文 <strong>元の太字</strong>"));
const notBold = converter.parseMarkdown("## 通常 **元の太字**", { boldHeadings: { h2: false } });
assert.equal(notBold.html, "<h2>通常 <strong>元の太字</strong></h2>");
const clamped = converter.parseMarkdown("本文", { spacingMode: "unified", includeTrailingSpacing: true, spacing: { all: { before: -1, after: 99 } } });
assert.equal(clamped.html, ["<p>本文</p>", ...Array(10).fill(blank)].join("\n"));
assert.equal(converter.parseMarkdown("# タイトル", customOptions).html, "");

const edges = converter.parseMarkdown("## 先頭\n\n本文", {
  spacingMode: "unified", includeLeadingSpacing: true, includeTrailingSpacing: true,
  spacing: { all: { before: 2, after: 1 } }
});
assert.equal(edges.html, [blank, blank, "<h2>先頭</h2>", blank, blank, "<p>本文</p>", blank].join("\n"));
assert.equal(converter.parseMarkdown("## 先頭\n\n本文").html, "<h2>先頭</h2>\n<p>本文</p>");
assert.equal(converter.parseMarkdown("## 除外\n\n本文", { removeFirstHeading: true }).html, "<p>本文</p>");

const consecutiveHeadings = converter.parseMarkdown("# H1\n\n## H2\n\n### H3\n\n本文", {
  spacingMode: "custom",
  consecutiveHeadingSpacing: 2,
  spacing: {
    h1: { before: 0, after: 6 }, h2: { before: 5, after: 4 },
    h3: { before: 3, after: 1 }, body: { before: 3, after: 0 }
  }
});
assert.equal(consecutiveHeadings.html, [
  "<h1>H1</h1>", blank, blank, "<h2>H2</h2>", blank, blank, "<h3>H3</h3>", blank, blank, blank, "<p>本文</p>"
].join("\n"));

const obsidian = converter.parseMarkdown(`---
source: "https://example.test/source"
---

# 01\\. トレーラ

[[folder/00_目次|目次]] / [[folder/01_PL概要]]

Twitter：@chicken1\\_skin

\\*文字としての星印\\*

\`code\\.keeps\\_escapes\`

<!-- 原文ここから -->

![画像_01](<画像/画像_01.jpg>)
`);
assert.match(obsidian.html, /<h1>01\. トレーラ<\/h1>/);
assert.ok(!obsidian.html.includes("01\\."));
assert.match(obsidian.html, /<p>目次 \/ 01_PL概要<\/p>/);
assert.match(obsidian.html, /@chicken1_skin/);
assert.ok(!obsidian.html.includes("<em>skin"));
assert.match(obsidian.html, /<p>\*文字としての星印\*<\/p>/);
assert.match(obsidian.html, /code\\\.keeps\\_escapes/);
assert.ok(!obsidian.html.includes("<code>"));
assert.ok(!obsidian.html.includes("source:"));
assert.ok(!obsidian.html.includes("原文ここから"));
assert.match(obsidian.html, /【画像：画像_01｜&lt;画像\/画像_01\.jpg&gt;】/);
assert.ok(obsidian.warnings.some((warning) => warning.includes("YAMLメタデータを1件")));
assert.ok(obsidian.warnings.some((warning) => warning.includes("HTMLコメントを1件")));
assert.ok(obsidian.warnings.some((warning) => warning.includes("表示名だけ")));
const obsidianEmbedSize = converter.parseMarkdown("![[画像/sample.png|300]]\n\n```text\nコード本文\n```");
assert.match(obsidianEmbedSize.html, /【画像：sample\.png｜画像\/sample\.png】/);
assert.ok(!obsidianEmbedSize.html.includes("<code>"));
assert.equal(obsidianEmbedSize.images[0].alt, "sample.png");

// YAMLプロパティは各ファイルの先頭（frontmatterStarts）だけで除外します。
// 結合した2ファイル目の先頭は、1ファイル目の5行 + 区切りの空行1つ = 6行目です。
const joinedSource = "---\nsource: one\n---\n\n# 一\n\n---\nsource: two\n---\n\n# 二";
const joinedFrontmatter = converter.parseMarkdown(joinedSource, { frontmatterStarts: [0, 6] });
assert.ok(!joinedFrontmatter.html.includes("source:"));
assert.equal((joinedFrontmatter.warnings.join(" ").match(/YAMLメタデータを2件/g) || []).length, 1);
// 開始位置を渡さない（貼り付け原稿）場合、途中の「---」で挟まれた行は本文として残します。
// 以前は「HP: 10 / MP: 5」のようなステータス表がYAMLと誤認され、無警告で消えていました。
const statBlock = converter.parseMarkdown("前の段落\n\n---\nHP: 10\nMP: 5\n---\n\n後の段落");
assert.ok(statBlock.html.includes("HP: 10"));
assert.ok(statBlock.html.includes("MP: 5"));
assert.ok(!statBlock.warnings.some((warning) => warning.includes("YAML")));

// Setext見出し：段落直下の「===」は見出し1、「---」は見出し2。空行を挟んだ「---」は区切り線のまま。
const setext = converter.parseMarkdown("章タイトル\n===\n\n節タイトル\n---\n本文\n\n---\n\n末尾");
assert.equal(setext.html, "<h1>章タイトル</h1>\n<h2>節タイトル</h2>\n<p>本文</p>\n<p>──────────</p>\n<p>末尾</p>");
assert.equal(converter.parseMarkdown("章タイトル\n===\n\n本文", { removeFirstHeading: true }).html, "<p>本文</p>");
assert.equal(converter.parseMarkdown("章タイトル\n===", { firstH1AsTitle: true }).title, "章タイトル");

// 単語内の「_」は書式にしません（CommonMark）。空白で区切られた「_斜体_」「__太字__」は従来どおり。
const intraword = converter.parseMarkdown("変数 player_hp_max と __init__ と _斜体_ と a__b__c");
assert.equal(intraword.html, "<p>変数 player_hp_max と <strong>init</strong> と 斜体 と a__b__c</p>");
// 識別子の内側が空白なら書式にしません。「2 * 3 * 4」の乗算記号が消えないようにします。
assert.equal(converter.parseMarkdown("2 * 3 * 4 と ** 太字ではない **").html, "<p>2 * 3 * 4 と ** 太字ではない **</p>");
assert.equal(converter.parseMarkdown("== 下線ではない == と ==下線==").html, "<p>== 下線ではない == と <u>下線</u></p>");

// 表の区切り行には「|」が必要です。「|」を含む段落の直後の「---」はSetext見出しとして扱います。
const pipeThenRule = converter.parseMarkdown("AかB | C\n---\n次の本文");
assert.equal(pipeThenRule.html, "<h2>AかB | C</h2>\n<p>次の本文</p>");
assert.ok(!pipeThenRule.warnings.some((warning) => warning.includes("表")));
// 「|」を含むだけの本文には表の警告を出しません。
assert.ok(!converter.parseMarkdown("AとB | 補足").warnings.some((warning) => warning.includes("表")));
assert.ok(converter.parseMarkdown("| A | B |\n|---|---|\n| 1 | 2 |").warnings.some((warning) => warning.includes("表")));

// 「~~~」のコードフェンスも認識します。
assert.equal(converter.parseMarkdown("~~~\ncode\n~~~").html, "<p>code</p>");

const obsidianTable = converter.parseMarkdown("| 場所 | 参照 |\n| --- | --- |\n| A | [[folder/file\\|表示名]] |");
assert.match(obsidianTable.html, /<p>A ｜ 表示名<\/p>/);

const styledList = converter.parseMarkdown("- 項目\n2. 番号", {
  listMarker: "  → ",
  listPrefixBold: true, listPrefixUnderline: true,
  listContentBold: true, listContentUnderline: true
});
assert.match(styledList.html, /<p><u><strong>&nbsp;&nbsp;→&nbsp;<\/strong><\/u><u><strong>項目<\/strong><\/u><\/p>/);
assert.match(styledList.html, /<p><u><strong>2\.&nbsp;<\/strong><\/u><u><strong>番号<\/strong><\/u><\/p>/);
const blankListMarker = converter.parseMarkdown("- 空白だけ", { listMarker: "   " });
assert.equal(blankListMarker.html, "<p>&nbsp;&nbsp;&nbsp;空白だけ</p>");

const underlinedBlocks = converter.parseMarkdown("# H1\n\n## H2\n\n### H3\n\n> 注釈\n\n本文", {
  boldHeadings: { h1: true },
  underlineBlocks: { h1: true, h2: true, h3: true, note: true, body: true }
});
assert.match(underlinedBlocks.html, /<h1><u><strong>H1<\/strong><\/u><\/h1>/);
assert.match(underlinedBlocks.html, /<h2><u>H2<\/u><\/h2>/);
assert.match(underlinedBlocks.html, /<h3><u>H3<\/u><\/h3>/);
assert.match(underlinedBlocks.html, /<blockquote><u>注釈<\/u><\/blockquote>/);
assert.match(underlinedBlocks.html, /<p><u>本文<\/u><\/p>/);

const inlineUnderline = converter.parseMarkdown("### <u>見出し</u>\n\n<u>本文</u>\n\n> <u>**注釈太字**</u>");
assert.match(inlineUnderline.html, /<h3><u>見出し<\/u><\/h3>/);
assert.match(inlineUnderline.html, /<p><u>本文<\/u><\/p>/);
assert.match(inlineUnderline.html, /<blockquote><u><strong>注釈太字<\/strong><\/u><\/blockquote>/);
assert.ok(!inlineUnderline.warnings.some((warning) => warning.includes("生HTML")));
const safeObsidianHtml = converter.parseMarkdown("<u>下線</u><br><s>打消し</s>");
assert.equal(safeObsidianHtml.html, "<p><u>下線</u><br>打消し</p>");
const mixedHtmlAsMarkdown = converter.parseMarkdown("<h1><u>HTML原稿</u></h1>");
assert.match(mixedHtmlAsMarkdown.html, /&lt;h1&gt;<u>HTML原稿<\/u>&lt;\/h1&gt;/);
assert.ok(mixedHtmlAsMarkdown.warnings.some((warning) => warning.includes("属性なしの<u>・<s>・<br>だけを認識")));
const unsafeInlineHtml = converter.parseMarkdown("<u onclick=\"alert(1)\">危険</u>");
assert.ok(!unsafeInlineHtml.html.includes("onclick=\"alert(1)\""));
assert.match(unsafeInlineHtml.html, /&lt;u onclick=&quot;alert\(1\)&quot;&gt;危険<\/u>/);
assert.ok(unsafeInlineHtml.warnings.some((warning) => warning.includes("生HTML")));

const defaultUnderlineMarker = converter.parseMarkdown("==下線==\n\n==**下線太字**==\n\n[ NPC1 ]");
assert.match(defaultUnderlineMarker.html, /<p><u>下線<\/u><\/p>/);
assert.match(defaultUnderlineMarker.html, /<p><u><strong>下線太字<\/strong><\/u><\/p>/);
assert.match(defaultUnderlineMarker.html, /<p>\[ NPC1 \]<\/p>/);
const customUnderlineMarker = converter.parseMarkdown("@@任意の記号@@", {
  inlineMarkers: { underline: { marker: "@@", mode: "wrap" } }
});
assert.equal(customUnderlineMarker.html, "<p><u>任意の記号</u></p>");
const startMarker = converter.parseMarkdown("!!行頭から下線", {
  inlineMarkers: { underline: { marker: "!!", mode: "start" } }
});
assert.equal(startMarker.html, "<p><u>行頭から下線</u></p>");
const endMarker = converter.parseMarkdown("行末まで下線!!", {
  inlineMarkers: { underline: { marker: "!!", mode: "end" } }
});
assert.equal(endMarker.html, "<p><u>行末まで下線</u></p>");
const asymmetricMarker = converter.parseMarkdown("[b]前後が違う太字[/b]", {
  inlineMarkers: { bold: { mode: "pair", startMarker: "[b]", endMarker: "[/b]" } }
});
assert.equal(asymmetricMarker.html, "<p><strong>前後が違う太字</strong></p>");
const missingAsymmetricMarker = converter.parseMarkdown("[b]閉じていない太字", {
  inlineMarkers: { bold: { mode: "pair", startMarker: "[b]", endMarker: "[/b]" } }
});
assert.equal(missingAsymmetricMarker.html, "<p>[b]閉じていない太字</p>");
const commonSample = "TALTO移行サンプル\nこれは通常の本文です。\n[ NPC1 ]は角括弧を含む変数の見本です。\n・ 箇条書きを通常の本文で再現した見本です。\n最後の本文です。";
const commonSampleHtml = converter.parseMarkdown(commonSample).html;
assert.equal(converter.parsePlainText(commonSample).html, commonSampleHtml);
assert.equal(converter.parsePixiv(commonSample).html, commonSampleHtml);

const literalText = converter.parsePlainText("# 見出しではない\n**太字ではない**\n\n[ NPC1 ]");
assert.equal(literalText.html, "<p># 見出しではない<br>**太字ではない**</p>\n<p></p>\n<p>[ NPC1 ]</p>");
const commonmarkWiki = converter.parseMarkdown("[[folder/file|表示名]]", { markdownFlavor: "commonmark" });
assert.match(commonmarkWiki.html, /\[\[folder\/file\|表示名\]\]/);
const gfmTask = converter.parseMarkdown("- [x] 完了\n- [ ] 未完了", { markdownFlavor: "gfm" });
assert.match(gfmTask.plainText, /・ ☑ 完了/);
assert.match(gfmTask.plainText, /・ □ 未完了/);
const obsidianFeatures = converter.parseMarkdown("%% 非表示 %%\n\n> [!note]+ タイトル\n> 本文\n\n- [?] 独自完了", { markdownFlavor: "obsidian" });
assert.ok(!obsidianFeatures.html.includes("非表示"));
assert.match(obsidianFeatures.html, /<blockquote>タイトル<br>本文<\/blockquote>/);
assert.match(obsidianFeatures.plainText, /・ ☑ 独自完了/);
assert.ok(obsidianFeatures.warnings.some((warning) => warning.includes("Callout")));

const pixiv = converter.parsePixiv(`[chapter:第一章]

[b:太字]と[i:斜体]

[[jumpuri:外部 > https://example.test]]

[[rb:惑星 > わくせい]]

[[emphasismark:重要>・]]

[newpage]

[jump:2]

[pixivimage:12345-1]`);
assert.match(pixiv.html, /<h1>第一章<\/h1>/);
assert.match(pixiv.html, /<strong>太字<\/strong>と斜体/);
assert.match(pixiv.html, /外部（https:\/\/example\.test）/);
assert.match(pixiv.html, /惑星（わくせい）/);
assert.match(pixiv.html, /<u>重要<\/u>（傍点：・）/);
assert.match(pixiv.html, /【ページ移動：2】/);
assert.match(pixiv.html, /【画像：pixiv挿絵｜pixivimage:12345-1】/);
assert.equal(pixiv.images.length, 1);

console.log("converter tests passed: spacing, headings, underline, pseudo-lists, Obsidian syntax, tables, bounds");
