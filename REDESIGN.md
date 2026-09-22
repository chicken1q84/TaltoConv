# talto_ReDesign

<!-- 元企画 / 目的 / scope 宣言 / 状態 / ポート / 取り込み手順 / 比較シートの場所 -->

## 元企画
- リポジトリ: `D:\Coding\Workbench\talto\migration-helper-v2`（branch `main`、GitHub `chicken1q84/TaltoConv`、v1.0.0 配布済み）
- 本フォルダは元の **git clone**、branch `redesign`。`origin` はローカルの元リポジトリ（GitHub には push しない）
- 作成日: 2026-09-22
- 製品自体の説明は [README.md](README.md)（元企画のもの。書き換えない）

## 目的
機能が一段落した TaltoConv の**見た目と操作**を磨く。設計の前提は `PRODUCT.md`、値は `DESIGN.md`、手順は `AGENTS.md`。道具は `D:\Coding\Workbench\Design\`。

## scope 宣言
- **機能追加・仕様変更をしない。** 変えるのは 見た目・文言・操作順・状態表示 のみ
- 途中で見つけたバグは直してよいが、コミットを `fix:` で分ける（取り込み時に識別するため）
- 変える変数は 1 つずつ。良い版（baseline）と並べて見る
- 既存の e2e（`npm run test:e2e`）を各画面ごとに通す

## 状態
- **進行中**（2026-09-22〜）
- 最初のバックログ: `Wiki\talto-migration-helper-ui-review.md` の P1

## ポート
- dev server: **8766**（元企画の 8765 / 8767 と分ける。同時起動時に e2e が相手を検査しないため）
- `.claude/launch.json`（`redesign-source`）と `playwright.config.mjs`（`PORT` 環境変数、既定 8765）で指定
- e2e を本フォルダで走らせるときは `PORT=8766 npm run test:e2e`（PowerShell: `$env:PORT=8766; npm run test:e2e`）

## 取り込み手順
- 完了企画なので **交代型** を想定: 磨き終わったら `Wiki\作業台.md` の企画表の「場所」を本フォルダに書き換え、GitHub リモートを付け替え、元を「凍結」に
- 取込型にする場合: 元企画で `git fetch ..\talto_ReDesign redesign && git merge redesign`

## 比較シート
- `docs/redesign/<日付>/baseline-contact-sheet.png`（作業前）
- `docs/redesign/<日付>/final-contact-sheet.png`（作業後）
- `.vqa/` は一時出力（gitignore）

## ループの記録
| 日付 | 画面 | 指摘数（P1/P2/P3） | 採用 | 所要時間 | 備考 |
| --- | --- | --- | --- | --- | --- |
