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
- 2026-09-27: loop1〜3（`480e590` まで）を**取込型**で元企画の main へ fast-forward し、GitHub（`chicken1q84/TaltoConv`）へ push。Web 版（GitHub Pages）に反映。作業資料（本書・DESIGN.md・docs/redesign など）も公開リポジトリに入った（ユーザー判断）。VERSION は 1.0.0 のまま（BOOTH の ZIP は未更新）

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
| 2026-09-22 | baseline 全 7 状態 × 3 幅 | 2 / 4 / 4 | P1 2 件（工程短縮・↗ 削除） | reviewer 4.7 分 / 114k tok、修正〜after 約 15 分 | reviewer は general-purpose(opus) で代用（agents はセッション開始時読込のため）。codex-review は Codex 使用量上限で未実施 |
| 2026-09-22 | loop2（同 7 状態 × 3 幅） | 前回の P2 4 件 + 軽微 2 件 | 全件 | 約 20 分 | design-reviewer は途中で中断（指摘なし）。e2e 51 passed。codex-review は未実施 |
| 2026-09-27 | loop3（同 7 状態 × 3 幅、ライト + ダーク） | reviewer 3 / 3 / 4、Codex 4 / 5 / 0 | 13 件（A〜M）、見送り 6 件 | reviewer 7.6 分 / 113k tok、協議 2 回、修正〜after 約 25 分 | 初めて design-reviewer エージェントと Codex を並行。採否は `docs/redesign/2026-09-27/decisions.md`。e2e 51 passed / 5 skipped。Codex のコードレビューは 5 時間枠上限で途中停止 → REVIEW_DEBT |

## バックログ（design-reviewer 2026-09-22 の未対応分）
- [x] P2 ≤900 でタブ見出しとカード内見出し「01 原稿」が二重 → ≤900 で `.section-heading` を視覚的に隠した（2026-09-22）
- [x] P2 04 確認だけカード枠が無い → (a) 04 も `.card` にした（2026-09-22）
- [x] P2 ≤900 で textarea が固定 270px → `#source { min-height: max(270px, calc(100dvh - 380px)) }`（2026-09-22）
- [x] P2 ホームの折りたたみを「見出し + 右端の山形」に統一。免責は罫線行、枠付きは必読 1 つだけ（2026-09-22）
- [x] P3 「サンプルを読み込みました。」トーストが最重要行に重なる → 削除（2026-09-27 loop3 D）
- [ ] P3 空行ステッパーの幅不揃い（228px × 2 / 140px × 1）→ 390 で 3 組横並びは不可（Codex）。「ラベル上 + 同幅」案は HTML の組み替えになるので次回
- [x] P3 「設定の管理」の大型 secondary × 2 → text-button 3 つを 1 行に（2026-09-27 loop3 K）
- [ ] P3 Ctrl+V 表記の不統一（kbd / プレーン）→ 未着手。text-button の高さは既に 44px
- [x] その他: タブ番号 11px → 12px、「この端末」バッジ 99px → 4px、パネル見出し 17px → 16px（2026-09-22）
- [x] その他: ヘッダーのテーマ select の枠を軽くする → やらない（2026-09-27。--control-border を弱める規定値が無い。Codex・主担当とも同意見）
- [ ] codex-review（コード観点）→ 2026-09-27 に依頼したが Codex の 5 時間枠上限で途中停止。19:10 以降に再実行（dev-forge `REVIEW_DEBT.md`）
- [ ] loop3 の見送り分: ホーム左端 3 通り、text-button の 9px 内寄せ、≤900 のプレビュー台 8px 枠、390 のプレビュー既定幅 PC、次回撮影に app-copied を追加
