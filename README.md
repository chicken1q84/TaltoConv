# TaltoConv（非公式TALTO移行ヘルパー）

手元の原稿（テキスト・Markdown・pixiv小説形式・HTML）を、TALTO の本文欄にそのまま貼り付けられる形に変換する道具です。見出し・注釈・太字・下線・空行を TALTO の書式に整えます。

TALTO の運営とは関係のない、個人制作の非公式ツールです。

## 入手方法

| 端末 | 入手先 |
|---|---|
| Windows | BOOTH で配布する ZIP（準備中）を展開し、`TaltoConv.html` を Edge または Chrome で開く |
| iPhone・iPad・Android | **https://chicken1q84.github.io/TaltoConv/** を Safari または Chrome で開き、「ホーム画面に追加」 |

どちらもネット接続なしで動きます（Web 版は一度開いてホーム画面に追加した後）。原稿はお使いの端末の中だけで処理し、外部へ送信しません。

## 使い方

1. 「変換を始める」を押す
2. **原稿** — 貼り付けるか、ファイル・フォルダから読み込む
3. **形式** — 原稿の書き方（Markdown の種類など）を 1 つ選ぶ
4. **設定** — 空行や太字・下線などの変換方法を決める
5. **確認** — 結果を見て「リッチテキストをコピー」
6. TALTO の本文欄に貼り付け（Windows は Ctrl+V、スマホは長押し → ペースト）、保存後に再読み込みして書式が残っているか確認

コピーできない場合は「自動コピーがうまくいかない場合」から手動でコピーできます。画像ファイルは読み込まず、原稿内の画像の位置に「【画像：説明｜参照先】」という目印を残すので、それを見ながら TALTO 側で挿入してください。

> **必ず守ってほしいこと**: 元の原稿は別に保管してください。このツールは変換専用で、原稿を編集・管理するものではありません。最初は短い原稿で試してから本番の原稿を移してください。

詳しい変換の仕様と手順は [docs/MIGRATION_GUIDE.md](docs/MIGRATION_GUIDE.md)、対応環境は [docs/対応環境.md](docs/対応環境.md)、分かっている制限は [docs/既知の問題.md](docs/既知の問題.md) にあります。

## 対応環境

| 端末 | 対応 |
|---|---|
| Windows 11 25H2 | Microsoft Edge 153 / Google Chrome 153 以降 |
| iPhone・iPad | iOS 27 / iPadOS 27 の Safari（Web 版） |
| Android 17 | Google Chrome 153 以降（Web 版）。**実機では未検証** |

バージョンは 2026 年 9 月 17 日時点の最新正式版です。古い OS、アプリ内ブラウザ（X・LINE など）、上記以外のブラウザは動作保証の対象外です。

Android は制作者の手元に実機がなく、**未検証**です（画面のエミュレーションのみ確認）。動作報告をいただけると助かります。

## 対応する原稿

- 貼り付け: プレーンテキスト、CommonMark、GFM、Obsidian Markdown、pixiv小説形式、HTML
- ファイル・フォルダ: `.txt` `.md` `.markdown` `.html` `.htm`

複数ファイルは一覧の上から順に 1 つの原稿として結合します（並べ替え可）。ファイルの種類は自動判定しないので、「形式」で書き方を選びます。HTML とそれ以外が混在している場合は取り違え防止のため一度止まります。

通常の容量上限はファイル 1 つ 10MB、フォルダ合計 100MB です。スマホ・タブレットではそれより小さい原稿でも確認を求めます。

## 権利・免責

- 本ツールは個人が制作した非公式ツールであり、TALTO およびその運営元とは関係ありません。TALTO の名称、サービス、掲載作品その他の権利は、それぞれの権利者に帰属します
- 変換する原稿は、利用者自身が使用・移行する権利を持つものに限ってください
- 本ツールの利用によって生じたデータの消失、表示崩れ、保存失敗、その他の損害について、制作者は一切の責任を負いません
- TALTO 側の仕様変更により、変換結果が変わる可能性があります

ライセンス: MIT（[LICENSE.txt](LICENSE.txt)）

連絡先: [@chicken1_skin](https://x.com/chicken1_skin)。不具合報告は原稿そのものではなく、再現できる短いサンプルを添えていただけると助かります。

---

## 開発者向け

ツール本体は依存パッケージなしの HTML / CSS / JavaScript で、`TaltoConv.html` を直接開けば動きます。構成と変更箇所の案内は [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)、配布までの計画は [docs/CROSS_PLATFORM_BOOTH_RELEASE_PLAN.md](docs/CROSS_PLATFORM_BOOTH_RELEASE_PLAN.md) を参照してください。

配布物は次の 3 つを同じソースから生成します。

- **ZIP 版**（Windows 向け）: 最上位に `TaltoConv.html` と `はじめにお読みください.txt`、それ以外は `TaltoConv_files/` にまとめる
- **Web 版**（`dist/`、GitHub Pages で配信）: ホーム画面に追加するとオフラインで起動できる
- **単一ファイル版**（ZIP に同梱）: CSS・JS を 1 つの HTML に埋め込んだ予備

開発用コマンドには Node.js 22 以降が必要です。

```bash
npm test                              # Node のテスト一式（変換・構造・共通原稿・ランダム入力・配布物）
npx playwright test                   # 画面幅・操作・端末エミュレーション・PWA（初回は npm install と npx playwright install chromium webkit）
node tools/serve.mjs                  # ソースをローカル表示 http://127.0.0.1:8765/
node tools/serve.mjs 8767 dist        # Web 版をローカル表示
node tools/build-release.mjs          # ../release/TaltoConv_v<版>/ と zip、dist/ を作る（--web-only で dist/ だけ）
```

- 変換規則を意図して変えたときは `node tests/test-fixtures.cjs --update` で共通原稿の期待出力を作り直し、差分を確認してからコミットします
- `main` へ push すると GitHub Actions が `dist/` を作って GitHub Pages へ配信し、別ジョブで Playwright（Chromium）を実行します
- 版を上げるときは `VERSION.txt` と `CHANGELOG.txt` を先に更新します。バージョンを変えない修正でも、配信ファイルのハッシュが変わるので Web 版の利用者には更新案内が届きます

設定は端末内に保存されますが、原稿本文と読み込んだファイルは保存しません。TALTO の非公開 API へ原稿を送信したり、TALTO 上のデータを直接変更したりしません。
