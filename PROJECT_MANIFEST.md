---
project: talto_ReDesign
path: "D:\\Coding\\Workbench\\talto_ReDesign"
tier: 0
writer: claude（REDESIGN.md の運用）
status: active
relation: { redesign-of: talto, prefix: migration-helper-v2 }
updated: 2026-09-23
---

# talto_ReDesign — PROJECT MANIFEST

AI が最初に読む 1 枚。**ここに書いてあることを調べ直さない。** 足りなければ必要なファイルだけ追加で読む。

## 何を作る企画か

完成した TaltoConv の見た目と操作だけを磨く。**機能追加・仕様変更はしない**（`REDESIGN.md:11-17`）。

## いまどこまで完成しているか

**進行中**（`REDESIGN.md:21`）。見直し 2 周済みで、P1 2 件・P2 4 件は対応済み。残りは P3 4 件、テーマ select の枠、codex-review（`REDESIGN.md:49-55`）。

**動作**: `npm test` は Node テスト 6 本、e2e は 5 本（`e2e\*.spec.mjs`）。2 周目の記録に「e2e 51 passed」（`REDESIGN.md:42`）。CI は main への push でだけ動くので、redesign ブランチでは走らない（`.github\workflows\pages.yml:8,59`）。

## 重要な設計思想

- **依存パッケージなし、オフライン必須、原稿を外部に送らない・保存しない**（`PRODUCT.md:25-35`）
- UI を変えるときは「足すより引く」を先に考え、`DESIGN.md` に無い値を作らない（`AGENTS.md:12,17`）
- 変える変数は 1 つずつで、baseline と比べる（`REDESIGN.md:17`）

## 再利用できるもの

| 種別 | 場所 | 説明 |
| --- | --- | --- |
| Tool | `tools\build-release.mjs` | ZIP 版・Web 版・単一ファイル版を作り、アイコンも生成 |
| Tool | `tools\serve.mjs` / `tools\pwa\` | ローカル配信・PWA |
| Test | `tests\test-fixtures.cjs` | 共通原稿で期待出力と比べる仕組み |
| 雛形 | `PRODUCT.md` / `DESIGN.md` / `AGENTS.md` / `vqa.json` | ReDesign の進め方の実例 |

## 技術的負債 / 既知の問題

- Android と iPad の実機検証がまだ（`docs\既知の問題.md:28-29`）
- codex-review が Codex の使用量上限で 2 周とも未実施（`REDESIGN.md:41-42`）
- **`tools\build-release.mjs:31` がリポジトリの 1 つ上の `release\` に書き出す**。ReDesign でビルドすると `D:\Coding\Workbench\release\` ができ、作業台の規約（Workbench 直下に単発のフォルダを作らない）に反する。いまは存在しない

- 契約との差分（機械検出 2026-09-23）: gitignore（不足・(a)）。詳細は `Workbench\dev-forge\CONTRACT_GAP.md`。(a) は T8 で直す

## 他企画との関係

- `talto\migration-helper-v2` の clone（branch `redesign`、origin はローカルの v2）。v2 の main は `a666e1b` で止まり、ReDesign が 8 コミット先行
- 取り込みは ReDesign が主系統を引き継ぐ「交代型」を想定（`REDESIGN.md:30`）

## 依存（ランタイム）

| 依存 | 理由 | ライセンス |
| --- | --- | --- |

## 入口となるファイル

| 目的 | ファイル |
| --- | --- |
| README | `README.md` |

## コマンド

```
テスト: npm test
ビルド: 
起動: npm run serve
```
