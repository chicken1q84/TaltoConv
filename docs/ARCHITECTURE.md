# 改修版の構成

この版は、利用者が HTML をダブルクリックして起動できることを維持しながら、変更理由の異なるコードを分離しています。ローカルファイルでも動くよう、JavaScript は ES Modules ではなく読み込み順が明示された通常のスクリプトです。

## フォルダ構成

```text
migration-helper-v2/
├─ 非公式TALTO移行ヘルパー.html  画面の構造
├─ src/
│  ├─ styles/app.css             見た目とレスポンシブ表示
│  └─ scripts/
│     ├─ converter.js            原稿の解析・TALTO向け変換
│     ├─ format-catalog.js       入力形式の対応表
│     └─ app.js                  画面操作・ファイル読込・コピー
├─ tests/                        通常テスト・構造テスト・ランダム入力テスト（Nodeのみ。配布物に同梱）
├─ e2e/                          Playwrightによる画面幅・操作の検査（開発専用。配布物に含めない）
├─ tools/                        ローカル表示・配布物（フォルダとzip）作成
├─ docs/                         設計・移行・コメント方針・配布計画
├─ package.json                  Playwrightなど開発専用の依存だけを管理
├─ playwright.config.mjs         e2e の実行設定（Chromium と WebKit）
└─ LICENSE.txt                   MIT
```

`tests/` と `tools/` の実行には Node.js 22 以降が必要です。ツール本体はブラウザだけで動きます。`e2e/` だけは `npm install` と `npx playwright install chromium webkit` が必要です。

このフォルダが git リポジトリのルートです。上位フォルダにある TALTO の復元コードや通信記録はリポジトリに含めません。

## 依存方向

```text
HTML → converter.js
     → format-catalog.js
     → app.js → 上記2ファイルの公開APIを利用

tests → converter.js / format-catalog.js
```

`converter.js` と `format-catalog.js` は画面要素を直接操作しません。画面変更が変換結果へ波及しにくく、ブラウザなしで検査できます。

## 変更内容別の入口

| 変更したい内容 | 主に編集する場所 |
|---|---|
| Markdown・HTML・Pixiv記法の変換 | `src/scripts/converter.js` |
| 形式選択時の対応表・説明文 | `src/scripts/format-catalog.js` |
| ボタン、設定、ファイル一覧、コピー | `src/scripts/app.js` |
| 色、余白、PC・スマホ表示 | `src/styles/app.css` |
| 項目や画面構造 | `非公式TALTO移行ヘルパー.html` |
| 配布内容 | `tools/build-debug-package.mjs` |

## 安全な改修手順

1. 変更前に `node tests/test-converter.cjs` と `node tests/test-structure.cjs` を実行する。
2. 対象の責務を持つファイルだけを変更する。
3. 通常テスト、構造テスト、`node tests/fuzz-converter.cjs` を再実行する。HTMLの参照先や形式の選択肢を変えた場合は、構造テスト側の期待値も更新する。
4. `node tools/serve.mjs` でPC幅とスマホ幅を確認する。見た目を変えた場合は `npx playwright test` で代表幅の横スクロールも検査する。
5. `node tools/build-debug-package.mjs` で改修デバッグ版を作る。3種のテストが自動で走り、`release/` に実行日付のフォルダとzipができる。配布フォルダ内のHTMLを直接開いて起動を確認する。

## 今後の分割基準

`app.js` 内の一領域が独立して大きくなったら、入力収集、設定保存、クリップボード、プレビューの順でサービスへ切り出します。ただし、行数だけを理由に細分化せず、「単独で説明・テストできる責務」ができた時点で分けます。

教科書調コメントの維持基準は `COMMENTING_PLAN.md` にまとめています。処理を逐語的に説明するコメントではなく、理由・制約・失敗時の挙動を中心に記述します。配布はソース、テスト、設計資料を含む改修デバッグ版だけを生成します。
