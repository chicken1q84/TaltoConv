# DESIGN.md — TaltoConv

<!-- 生成時の唯一のデザイン正本。ここに無い値を新設しない。 -->
<!-- 下書き: 2026-09-22。src/styles/app.css（437 行）から機械抽出した「現状」に、異常値の整理案を「→ 提案」として併記。提案の採否はユーザー確認後に確定する。 -->

## 0. 参照
- 方針: 無し（デザインパック未作成）。Wiki の `design/layout-basics.md`、`design/japanese-typography-web.md`、`design/color-and-contrast.md` を一般原則として使う
- 参考画像: 無し（references/ 未作成）
- 作業前の姿: `docs/redesign/2026-09-22/baseline-contact-sheet.png`

## 1. Visual concept（3 行以内）
- 雰囲気: 書き手の作業机。紫がかった無彩色の紙面に、藤色 1 色の操作。静かで、注意書きが多くても威圧しない
- 情報密度: 中。PC は 4 パネルを 1 画面に、スマホは 1 工程ずつ。長い原稿と設定値が読めることが最優先
- 主役: 原稿とプレビュー。UI chrome は脇役

## 2. Typography
| 用途 | font-family | size | weight | line-height | 現状の出現 |
| --- | --- | --- | --- | --- | --- |
| 本文・ラベル | -apple-system, "Segoe UI", "Yu Gothic UI", "Meiryo", sans-serif（`:root` 15px） | 14px | 400 | 1.7 | 14px × 31 |
| 補足 / caption | 同上 | 13px（**12px 未満禁止**） | 400 | 1.6 | 13px × 44、12px × 7、11px × 1 |
| 小見出し（パネル題・設定グループ） | 同上 | 15〜16px | 600 | 1.4 | 15px × 12、16px × 10、weight 600 × 18 |
| ダイアログ題・ブランド | 同上 | 18〜20px | 700 | 1.4 | 18px × 4、20px × 3 |
| ホーム H1 | 同上 | `clamp(28px, 3.2vw, 40px)` | 700 | 1.45 | 1 か所 |
| 原稿・記号入力 | Consolas, "Yu Gothic UI", monospace | 14px | 400 | 1.85 | textarea / .marker-name |
- 和文ルール: 本文の行長は 760〜780px（`.home-intro` / `.must-read-list` の max-width）で約 45 字。`overflow-wrap: anywhere` は長いパス・URL のみ
- 現状の異常値 → 提案:
  - line-height が 1 / 1.4 / 1.45 / 1.5 / 1.6 / 1.65 / 1.7 / 1.75 / 1.8 / 1.85 / 1.9 の **11 種** → **1.4（見出し）/ 1.6（補足）/ 1.75（本文・手順）/ 1.85（原稿 textarea）の 4 種**に寄せる
  - `font-weight: 750` が 1 か所、`bold` / `normal` 表記の混在 → 400 / 600 / 700 の 3 種に統一
  - 11px が 1 か所（要特定）→ 12px 以上へ
  - 17px / 23px / 24px / 32px が各 1〜2 か所 → 用途を確認し 16 / 20 / H1 のいずれかへ

## 3. Colors（CSS カスタムプロパティ名で書く）
| token | light | dark | 用途 |
| --- | --- | --- | --- |
| --canvas | #f7f6f2 | #17151c | ページ背景 |
| --surface | #fff | #211e27 | パネル・ダイアログ |
| --surface-soft | #faf9fc | #292530 | 注記の下地 |
| --field | #fff | #26222c | 入力欄 |
| --ink | #302d3a | #f1eef5 | 本文 |
| --muted | #5b5663 | #bbb5c2 | 補足 |
| --placeholder | #767078 | #a29bab | プレースホルダ |
| --line | #e1dde5 | #403a47 | 罫線・枠 |
| --control-border | #948da0 | #726a7d | 入力欄の枠 |
| --accent | #655181 | #c4addf | 主要操作（1 色のみ） |
| --accent-dark | #4e3c69 | #dcc9f2 | リンク・強調文字 |
| --soft | #f2eef7 | #342d40 | accent の淡い下地（バッジ・kbd・折りたたみ） |
| --focus | #765e9a | #c5abe7 | フォーカスリング（3px、offset 3px） |
| --preview-stage / --preview-paper | #f0eef2 / #fff | #17151c / #211e27 | プレビュー台と紙 |
- 状態色（**現状はトークン化されておらず、直書き**）:
  | 状態 | 背景 | 枠 | 文字 | 現状の直書き箇所 |
  | --- | --- | --- | --- | --- |
  | ok | #edf5ef | — | #4f6b57 | `.inline-feedback` |
  | warn | #fff8e8 / #fbf5e9 | #e3c78e / #efe4cc | #70552d / #886535 | `.mixed-warning`、`.warning-details`（**2 系統ある**） |
  | danger | #f8eded / #f9eded | #e2b8ba | #863c40 / #7f3d42 / #9a4b50 | `.inline-feedback.error`、`.limit-warning`、`.danger-toggle`（**3 系統ある**） |
- 現状の異常値 → 提案: 状態色を `--ok-bg/--ok-fg`、`--warn-bg/--warn-line/--warn-fg`、`--danger-bg/--danger-line/--danger-fg` の **8 トークンに集約し、ダーク値も定義**する（現状はダーク時の状態色が個別指定）。色数上限: accent 1 + 状態 3 + 無彩色。グラデーション不使用（現状も無し）
- 色だけで状態を伝えない（現状は枠 + 文言を併用できている）

## 4. Spacing
- 基準: 4px。使う段階: **4 / 8 / 12 / 16 / 24 / 32 / 48**（+ 罫線調整用の 1〜2px）
- 画面端の余白: 28px（PC、`main`）、16px（スマホ）。パネル内 24px（PC）
- 現状の出現: 16px × 37、12px × 22、8px × 21、**10px × 19、14px × 12、18px × 11、13px × 7、22px × 4、9px × 3、7px × 3**（太字はグリッド外）
- 現状の異常値 → 提案: グリッド外の 7 / 9 / 10 / 13 / 14 / 18 / 22px を近い段階に寄せる（10→8 or 12、14→12 or 16、18→16、22→24）。`gap` も 8 / 12 / 16 の 3 種を基本に

## 5. Radius
- 現状: 3 / 4 / 5 / 6 / 7 / 8 / 9 / 10 / 12 / 14 / 50% / 99px の **12 種**（`--control-radius: 8px` があるのに直書きが多い）
- → 提案: **4px（インライン code / kbd）、8px（入力・ボタン・注記、= `--control-radius`）、12px（パネル `.card`・ダイアログ）の 3 段階**。50% は丸ボタン（×）のみ。**99px のピル（「この端末」バッジ）は 4px へ**

## 6. Borders / Shadows / Surface
- 区切りは罫線 1px `--line` を第一候補（ホームの端末一覧・フッターは既にそう）
- 影は浮くものだけ、2 段階: 通知 `0 6px 24px #302d3a24`、ダイアログ `0 18px 48px #302d3a33`。`0 1px 3px` の弱い影が 1 か所（要特定 → 罫線に置換候補）
- パネル `.card`: padding 24px、1px `--line`、radius 12px、影なし。**カードは 01〜04 の工程パネルだけ**。設定の各項目・一覧の各行はカードで囲まない（現状も囲んでいない）
- ネストしたカード禁止

## 7. Iconography
- アイコンは使わない方針（現状: 開閉の山形 `.details-mark`、`→` のテキスト矢印、× のみ）。絵文字を UI に使わない。ラベルなしのアイコンボタンは禁止

## 8. Motion
- transition 150ms、対象は background と transform のみ（現状どおり）。page-load 演出なし。`prefers-reduced-motion` で全停止（実装済み）

## 9. Layout
- ヘッダー: 高さ 82px、ブランド左 / 「使い方」+ テーマ切替右、下罫線
- ホーム: max-width 960px、上下 48px。H1 → 1 文 → 主ボタン → 端末別の始め方（折りたたみ）→ 必読 → 免責 → フッター
- 変換画面（PC ≥901px）: 2 列。左に 01 原稿 / 02 形式 / 03 設定 を縦積み、右に 04 確認（プレビュー + コピー）。`main` max-width 1400px
- 最重要操作: 「書式付きでコピー」。PC は右列下部、スマホは固定フッター `.mobile-action`

## 10. Responsive behavior
| 幅 | 挙動 |
| --- | --- |
| ≥1061 | 2 列 |
| 901〜1060 | 2 列のまま余白を詰める（中間 @media） |
| ≤900 | 1 列 + 上部 sticky のステップタブ（01〜04）+ 固定フッターの主要操作（44px 以上）。キーボード表示中はフッターを隠す |
| ≤360 | H1 を `min(28px, calc((100vw - 32px) / 12.6))` に縮める |
- Windows 125% 表示（実質 1152px）で 2 列が崩れないこと

## 11. Component rules
- Button: primary（`--accent` 塗り、白文字、min-height 44px）は 1 画面に 1 つ（ホーム「変換を始める」、変換画面「書式付きでコピー」）。secondary は枠線のみ。text-button は下線リンク風。無効時は透明度でなく色で示す（`.primary:disabled`）
- 入力: `--control-height: 44px`、枠 `--control-border`。ラベルは上、補足は下
- セグメント切替（貼り付け / ファイル / フォルダ、PC / スマホ）: 同じ部品を使い回す
- 折りたたみ `<details>`: 見出し + 右端の山形。要約行に現在値を出す（設定グループ）
- 状態表示: 操作した場所の近くに枠付きで残す。トースト（`#status`）は補助
- 数値入力（空行数）: − / + ボタン付き、0〜10 に補正

## 12. Anti-patterns（見つけたら指摘対象）
- 12px 未満の文字、コントラスト 4.5:1 未満、色だけの状態表示
- 8px 段階に無い余白・角丸の新設（§4 / §5 の異常値を増やさない）
- 状態色の直書き（§3 のトークン化後は必ずトークンを使う）
- ピル型バッジ、装飾目的のアイコン・絵文字、グラデ背景
- 同じ情報を 2 か所に出す（例: コピー後の案内が ボタン直下 + トースト + 手動コピーの 3 か所にならないよう注意）
- ホームの端末別ガイド・必読・免責を「全部カード」で囲む（今は罫線 + 1 つの枠で抑えている。増やさない）
- 全面リデザイン。骨格（2 列 / ステップタブ）は固定

## 13. References（抽象化メモ）
無し。参照画像を置く場合は `references/README.md` の様式で。
