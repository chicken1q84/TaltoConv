# TaltoConv（非公式TALTO移行ヘルパー）

テキスト・Markdown・pixiv小説形式・HTMLを、TALTOへ貼り付けやすい形に変換する非公式ツールです。原稿は端末内だけで処理し、外部へ送信・保存しません。

## 入手方法

| 端末 | 入手先 |
|---|---|
| Windows | BOOTH で配布する ZIP（または [GitHub Releases](https://github.com/chicken1q84/TaltoConv/releases)）を展開し、`TaltoConv.html` を Edge または Chrome で開く |
| iPhone・iPad・Android | **https://chicken1q84.github.io/TaltoConv/** を Safari または Chrome で開き、「ホーム画面に追加」 |

Web版はホーム画面に追加した後、オフラインでも起動できます。

## 使い方

1. 原稿を貼り付けるか、ファイルを選ぶ
2. 形式と設定を選ぶ
3. 「書式付きでコピー」
4. TALTOへ貼り付け、保存後に書式を確認

コピーできない場合は画面の手動コピーを使えます。画像は「【画像：…】」を目印にTALTOで挿入します。

> **元の原稿は必ず別に保管し、最初は短い原稿で試してください。**

詳しい変換の仕様と手順は [docs/MIGRATION_GUIDE.md](docs/MIGRATION_GUIDE.md)、対応環境は [docs/対応環境.md](docs/対応環境.md)、分かっている制限は [docs/既知の問題.md](docs/既知の問題.md) にあります。

## 対応環境

| 端末 | 対応 |
|---|---|
| Windows 11 25H2 | Microsoft Edge 153 / Google Chrome 153 以降 |
| iPhone・iPad | iOS 27 / iPadOS 27 の Safari（Web 版） |
| Android 17 | Google Chrome 153 以降（Web 版）。**実機では未検証** |

2026年9月17日時点。Androidは**実機未検証**です。古いOS、アプリ内ブラウザ、上記以外のブラウザは動作保証外です。

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

- **ZIP 版**（Windows 向け）: 最上位に `TaltoConv.html` と `はじめにお読みください.txt`、`TaltoConv_files/` には動作に必要な `src/` と単一ファイル版・VERSION・CHANGELOG・LICENSE だけを入れる。テスト・設計資料・開発用ツールは同梱しない
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
