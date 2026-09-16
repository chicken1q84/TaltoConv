# TaltoConv クロスプラットフォーム対応・BOOTH無料配布計画（第3版）

更新日: 2026-09-17
第1版（2026-09-16）のレビューは [PLAN_REVIEW_2026-09-16.md](PLAN_REVIEW_2026-09-16.md)。第2版の Phase 0〜10 のうち、実装が済んだものを畳み、残りを実機確認の結果で優先順位を決められる形に組み直した。旧版の Phase 番号とは対応しない。

## 確定事項

| 事項 | 決定 |
|---|---|
| アプリ名 | **TaltoConv**（正式名称「非公式TALTO移行ヘルパー」は副題） |
| 目標 | Windows・iOS・Android すべてで**完全オフライン動作** |
| Windows | BOOTH の ZIP を展開して `TaltoConv.html` を開く。他のファイルは `TaltoConv_files/` にまとめ、触らせない |
| iOS・Android | **PWA** を主経路。https://chicken1q84.github.io/TaltoConv/ を一度開き「ホーム画面に追加」。単一ファイル HTML は予備（ZIP 同梱） |
| ホスティング | GitHub Pages。リポジトリ https://github.com/chicken1q84/TaltoConv の `main` へ push すると Actions が `dist/` を配信 |
| ライセンス | MIT |
| テスト | Node 単体の `tests/`（ZIP 同梱）と Playwright の `e2e/`（Chromium + WebKit、開発専用） |
| 更新の届け方 | `VERSION.txt` と配信ファイルのハッシュを Service Worker のキャッシュ名に含める。ファイルが1つでも変われば利用者側に「新しい版があります」が出る |
| 変えないこと | 原稿を外部送信しない。TALTO の非公開 API を使わない。貼り付け・画像挿入・保存確認は手作業 |

## これまでに済んだこと（2026-09-17 時点）

- リポジトリ公開、Pages 配信、MIT、Playwright、`.gitattributes`
- `VERSION.txt` / `CHANGELOG.txt`。ビルド `tools/build-release.mjs` が ZIP 版・Web 版・単一ファイル版を同時生成し、禁止フォルダの混入と単一ファイル版の構文を検査
- PWA（manifest、Service Worker の precache、更新案内バナー、アイコン「TC」、全 HTML にタブ用アイコン）
- クリップボード: Clipboard API → execCommand → 手動コピー欄。失敗理由を3種に分けて案内
- ホーム画面の「お使いの端末での始め方」（Windows / iPhone / iPad / Android、端末判定で該当項目を先頭に開く）
- 作業画面の「使い方」ダイアログ（PC / スマホ・タブレット）、端末別の貼り付け案内
- ZIP の2層化（`TaltoConv.html` + `はじめにお読みください.txt` / `TaltoConv_files/`）
- BOOTH 商品説明の下書き `docs/BOOTH_DESCRIPTION.md`
- 自動テスト: Node 3種、Playwright 29件（画面幅 8 段階、クリップボード 5 経路、使い方ダイアログ）

ローカルで確認済み: オフライン起動（サーバー停止状態で起動・変換）、更新サイクル（旧版に案内 → 再読み込み → 旧キャッシュ削除）、ZIP 版・単一ファイル版の `file://` 起動。

## 残りの段階

各段階は「実装 → 確認 → 完了条件」で書く。チェックは完了時に入れる。

### Phase A: iPhone 実機チェック（制作者・10分）

これが残作業全体の最大の不確定要素。結果で Phase B の中身と順序が決まるので、最初に行う。

手順（[BOOTH_DESCRIPTION.md](BOOTH_DESCRIPTION.md) の「使い方（iPhone…）」と同じ）:

1. Safari で https://chicken1q84.github.io/TaltoConv/ を開く → 共有 → ホーム画面に追加
2. 機内モードにしてホーム画面から起動する
3. 短い原稿（見出し・本文・太字）を貼って「確認」まで進み、「リッチテキストをコピー」を押す
4. TALTO のテスト用冊子の本文欄を長押し → ペースト
5. 保存済み表示後に再読み込み

記録すること:

- [x] 2: 機内モードで起動できたか（2026-09-17「大丈夫そう」との報告。個別の記録は未取得）
- [x] 3: 緑「コピーしました」か、赤「手動でコピーする」欄が開いたか。赤なら、その文言と「すべて選択 → コピー」で TALTO に書式付きで貼れたか（同上。どちらの経路だったかは未確認）
- [x] 4〜5: 見出し・太字が残ったか（同上）
- [x] 気づいた表示崩れ・押しにくい箇所（報告なし）

完了条件: 上の4点が記録され、Phase B の優先順位が決まる。

### Phase B: モバイル仕上げ（旧 Phase 2・4・5 を統合）

実機で問題が出た順に着手する。何も出なければ下の順で進める。

実装:

- [x] タッチ主体の端末では「フォルダ」の選択肢に「（PC向け）」を添え、フォルダ欄に「ファイルから複数選択」の代替案内を出す（UA 判定または `maxTouchPoints > 0` かつ `(pointer: coarse)`。`webkitdirectory` の有無では判定しない。並び順は貼り付け→ファイル→フォルダのまま）
- [x] ソフトウェアキーボード表示中は下部の固定ボタンを隠す（`visualViewport` の高さが 75% 未満に縮んだとき）。実機で入力中に確認すること
- [x] iPad 縦向き・狭い Split View は工程表示、横向き・広い幅は2カラム（スマホ用の境界を 760px → 900px に拡大）
- [x] 読み込み中・コピー中の状態表示と、処理中の二重操作防止（変換は同期処理のため対象外）
- [x] モバイル用の容量警告（スマホ 5MB/20MB、タブレット 10MB/30MB を超えると確認ダイアログ。止めはしない。実機計測後に見直す）
- [x] 読み込み失敗時にファイル名と対処を表示
- [x] OS の文字サイズ拡大への追従 — 不要と判断。iOS Safari の文字サイズと Android Chrome の文字拡大は px 指定にも適用されるため、rem 化しても挙動は変わらない

確認（Playwright と、可能な範囲で実機）:

- [x] 代表幅 360 / 375 / 390 / 430 / 768 / 820 / 1024 で横スクロールなし（自動）
- [x] iPhone / iPad 縦・横のエミュレーションで、フォルダ表記・案内の順・工程表示／2カラムを確認（`e2e/mobile.spec.mjs`）
- 縦横回転後も工程と入力内容が保たれる
- [x] 日本語入力中に固定ボタンが入力欄を覆わない（iPhone 実機で確認。ホーム画面版ではレイアウトが縮んでボタンがキーボードの上に乗り、押せる位置に残る。隠す処理は保険として残す）
- iPhone で「フォルダを追加」を選んでも行き止まりにならない

完了条件: iPhone と Windows で、変換開始からコピー・貼り付けまで迷わず到達できる。Android・iPad は Playwright のエミュレーションで横崩れがない。

### Phase C: 自動テストの拡張（旧 Phase 6）

実装:

- [x] `tests/fixtures/` に共通テスト原稿（見出し・注釈・本文・空行・太字・下線・リスト・表・リンク・画像プレースホルダー）と、その期待出力を置く（`tests/test-fixtures.cjs`。`--update` で期待出力を再生成）
- [x] Node テスト: ZIP 版・単一ファイル版・Web 版の HTML が同じ `converter.js` を含み、共通原稿の変換結果が一致すること（`tests/test-release.cjs`）
- [x] Node テスト: `dist/` と ZIP 版の構造（index.html / manifest / sw.js / precache 一覧と実ファイルの一致 / 禁止フォルダなし / VERSION の一致 / ZIP 最上位が 3 項目だけ）
- [x] Playwright: Service Worker 登録後に `context.setOffline(true)` で再読み込みできること（`e2e/pwa.spec.mjs`、Chromium）
- [x] Playwright: 版を上げた `dist/` へ差し替えたときに更新案内が出ること（配信中の一時フォルダを書き換えて確認。旧キャッシュの削除まで）
- [x] Playwright: タッチ端末エミュレーション（iPhone / iPad 縦・横）で入力方法の表記と工程表示を確認（`e2e/mobile.spec.mjs`。Phase B で実施）
- [x] GitHub Actions に Playwright（Chromium のみ）を別ジョブで追加。配信ジョブとは独立で、失敗しても配信は止めない（一覧で赤くなるので気づける）

完了条件: `npm test` と `npx playwright test` の両方が通らないと配布物を作らない状態にする（`build-release.mjs` から e2e も呼ぶか、リリース手順で必須にする）。
→ `build-release.mjs` は Node テスト（配布物検査を含む）を必須にした。Playwright はリリース手順（Phase F）で必須にする。ビルドのたびに 10 秒以上待たせないため。

### Phase D: 利用者向け文章の最終整理（旧 Phase 8）

コードが固まってから一度だけ通しで見直す。

- [ ] `はじめにお読みください.txt`（現在は `tools/templates/README-DEBUG.txt`。ファイル名も利用者向けに改める）
- [ ] `README.md`（GitHub で最初に見える。使い方と対応環境を前、開発手順は後ろ）
- [ ] 画面内の文章（ホーム、端末別の始め方、使い方ダイアログ、各工程の案内、エラー・警告、更新案内）
- [ ] `docs/MIGRATION_GUIDE.md`（手順の順序、TALTO 側の画面名、「解析根拠」の表現を公開向けに見直すか判断）
- [ ] `docs/対応環境.md`、`docs/既知の問題.md` を新規作成
- [ ] `CHANGELOG.txt` の v1.0.0 項目
- [ ] `docs/BOOTH_DESCRIPTION.md` の最終版
- [ ] アイコンを正式な絵柄に差し替えるか判断（現状はビルド生成の「TC」）

観点: 開発者向けの語（リポジトリ、ビルド、Service Worker）を利用者向け文章から外す。「非公式」「外部送信なし」「元原稿の保管」「画像は手動挿入」がどの入口からも1画面以内で目に入る。ZIP 版と Web 版で説明が食い違わない。文体・用語・記号を統一する。

完了条件: 制作者以外の1人が、説明書だけで起動からコピーまで到達できる。

### Phase E: 実機ベータ（旧 Phase 7）

手元にある端末:

- Windows 11 + Edge / Chrome
- iPhone（Phase A で1回目は済んでいる想定）

手元にない端末は Playwright のエミュレーションで代替し、`既知の問題.md` に「実機未確認」と明記する。借りられるなら iPad と Android 1台ずつを優先。

- [ ] Windows: ZIP を空フォルダへ展開し、説明書だけで起動からコピーまで
- [ ] iPhone: Phase D の文章で、ホーム画面追加 → 機内モード起動 → コピー → TALTO 貼り付け → 再読み込み
- [ ] （可能なら）iPad 縦・横・Split View
- [ ] （可能なら）Android Chrome

不具合区分: Blocker（起動不能・コピー不能・原稿消失）と Major（主要操作が画面外・代替なしの機能停止・変換の重大誤り）は公開不可。Minor は回避策を `既知の問題.md` に書けば公開可。

完了条件: Blocker と Major が 0 件。

### Phase F: v1.0.0 リリース（旧 Phase 9）

- [ ] `VERSION.txt` を `1.0.0`、`CHANGELOG.txt` を確定
- [ ] `node tools/build-release.mjs` → `release/TaltoConv_v1.0.0/` と zip、`dist/`
- [ ] push → Actions 成功 → Web 版で「新しい版があります」が出て 1.0.0 に切り替わることを確認
- [ ] GitHub の Releases に v1.0.0 を作り、ZIP を添付する（BOOTH の予備の入手先。任意）
- [ ] BOOTH に商品登録: 0 円、`BOOTH_DESCRIPTION.md` を転記、ZIP をアップロード、商品画像 5 枚
- [ ] 公開後、BOOTH からダウンロードした ZIP を空フォルダに展開して起動確認

完了条件（v1.0.0 公開判定）:

1. Windows 版の既存機能を後退させていない
2. Windows と iPhone でリッチテキストを TALTO へ貼り付け、保存後の再読み込みまで確認した（iPad・Android は実機があれば）
3. iPhone でホーム画面に追加し、機内モードで起動・変換・コピーできた
4. 自動コピー失敗時に手動コピーへ到達できる
5. フォルダ非対応環境でも、貼り付けまたは複数ファイル選択で完了できる
6. Blocker と Major が 0 件
7. BOOTH の ZIP を新しいフォルダへ展開し、同梱説明書だけで開始できる
8. BOOTH の商品説明だけで、スマホ利用者が Web 版へ到達しホーム画面に追加できる
9. 画面・ZIP 名・README・VERSION・CHANGELOG・Web 版のバージョンが一致する
10. 非公式・免責・MIT・対応環境・画像の手動挿入・元原稿保管を明記している

### Phase G: 公開後の保守（旧 Phase 10）

サーバーがないため、更新作業は「直して push」と「BOOTH のファイル差し替え」だけ。

- `VERSION.txt` を上げ、`CHANGELOG.txt` に修正内容と影響環境を書き、ビルドして push と BOOTH 差し替えを同時に行う
- 版を上げない小さな修正でも、ハッシュが変わるので Web 版の利用者には更新案内が届く。ZIP 版の利用者には届かないので、BOOTH の更新情報で知らせる
- TALTO 側の仕様変更が疑われたら、共通テスト原稿で再検証する
- iOS / Android のメジャー更新後は、コピー・ファイル選択・TALTO 貼り付け・オフライン起動を優先して再確認する
- 不具合報告には原稿本文の添付を求めず、再現用の最小サンプルを依頼する

## 進め方

```
A（iPhone 実機・制作者）──▶ B（モバイル仕上げ）──▶ C（テスト拡張）──▶ D（文章整理）──▶ E（実機ベータ）──▶ F（v1.0.0）──▶ G
```

- A は今すぐ。B の着手は A の結果待ち。
- C は B と並行できる（B の変更を C のテストで固める）。
- D は B・C が落ち着いてから一度だけ。文章を先に整えると B の変更で書き直しになる。
- 各段階の終わりに push し、Web 版の更新案内が出ることを確認する。

## いま制作者がやること

1. 未 push のコミット（URL 置換）を push する
   ```powershell
   cd D:\Coding\Workbench\talto\migration-helper-v2; git push
   ```
2. Phase A を実施して結果を伝える
