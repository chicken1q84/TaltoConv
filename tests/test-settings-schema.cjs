// 設定ファイルの検査（src/scripts/settings-schema.js）を、正しい例と壊れた例で固定します。
const assert = require("node:assert/strict");
const schema = require("../src/scripts/settings-schema.js");

const valid = {
  app: "unofficial-talto-migration-helper", version: 2, appVersion: "1.0.0", mode: "custom", sourceMode: "paste", format: "obsidian",
  values: { allBefore: 0, allAfter: 1, h1Before: 2, h1After: 0, h2Before: 1, h2After: 0, h3Before: 0, h3After: 0, noteBefore: 0, noteAfter: 0, bodyBefore: 0, bodyAfter: 0 },
  consecutiveHeadingSpacing: 1, listMarker: "・ ",
  markers: { bold: { mode: "wrap", marker: "**", startMarker: "**", endMarker: "**" }, underline: { mode: "pair", marker: "==", startMarker: "<u>", endMarker: "</u>" } },
  toggles: { italicAsNote: true, boldH1: false },
  open: { heading: true, list: false }
};
assert.deepEqual(schema.validate(valid), [], "正しい設定ファイルは問題なしになる");

// 項目が無いのは許す（旧版や一部だけのファイル）
assert.deepEqual(schema.validate({ app: "unofficial-talto-migration-helper", version: 2 }), []);
assert.deepEqual(schema.validate({ version: 1, values: { h1Before: 3 } }), []);

// 設定の形になっていない
assert.equal(schema.validate(null).length, 1);
assert.equal(schema.validate([1, 2]).length, 1);
assert.equal(schema.validate("text").length, 1);

const expectProblem = (saved, fragment) => {
  const problems = schema.validate({ app: "unofficial-talto-migration-helper", version: 2, ...saved });
  assert.ok(problems.some((problem) => problem.includes(fragment)), `「${fragment}」を含む問題が出るべき: ${JSON.stringify(problems)}`);
};

// 数値の範囲・型
expectProblem({ values: { h1Before: "abc" } }, "values.h1Before は 0〜10 の整数");
expectProblem({ values: { h1Before: 11 } }, "values.h1Before は 0〜10 の整数");
expectProblem({ values: { h1Before: 1.5 } }, "values.h1Before は 0〜10 の整数");
expectProblem({ values: { h1Before: -1 } }, "values.h1Before は 0〜10 の整数");
expectProblem({ values: { h9Before: 1 } }, "values に不明な項目 h9Before");
expectProblem({ values: "3" }, "values は項目名と数値の組");
expectProblem({ consecutiveHeadingSpacing: "2" }, "consecutiveHeadingSpacing は 0〜10 の整数");

// 選択肢
expectProblem({ mode: "auto" }, "mode は unified・custom");
expectProblem({ sourceMode: "clipboard" }, "sourceMode は");
expectProblem({ format: "markdown" }, "format は");
expectProblem({ markers: { bold: { mode: "both" } } }, "markers.bold.mode は");

// 文字列の制約
expectProblem({ listMarker: 12 }, "listMarker は");
expectProblem({ listMarker: "a\nb" }, "listMarker は");
expectProblem({ listMarker: "x".repeat(21) }, "listMarker は");
expectProblem({ markers: { underline: { marker: ["=="] } } }, "markers.underline.marker は");
expectProblem({ markers: { italic: { mode: "wrap" } } }, "markers に不明な項目 italic");
expectProblem({ markers: { bold: { color: "red" } } }, "markers.bold に不明な項目 color");

// 真偽値
expectProblem({ toggles: { italicAsNote: "yes" } }, "toggles.italicAsNote は true か false");
expectProblem({ toggles: { unknownToggle: true } }, "toggles に不明な項目 unknownToggle");
expectProblem({ open: { heading: 1 } }, "open.heading は true か false");

// 版とアプリ
assert.ok(schema.validate({ version: 3 }).some((problem) => problem.includes("version は")));
assert.ok(schema.validate({ version: 2, app: "other-app" }).some((problem) => problem.includes("app が別のアプリ")));
expectProblem({ appVersion: 1 }, "appVersion は文字列");
expectProblem({ theme: "dark" }, "不明な項目 theme");

// 複数の問題をまとめる文
const many = schema.validate({ version: 2, app: "unofficial-talto-migration-helper", mode: "x", format: "y", listMarker: 1, toggles: { a: 1 } });
assert.ok(many.length >= 4);
const described = schema.describeProblems(many, 3);
assert.match(described, /書式に合わない項目が\d+件/);
assert.match(described, /ほか\d+件/);

console.log("settings schema checks passed.");
