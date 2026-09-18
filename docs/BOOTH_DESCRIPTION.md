# BOOTH 商品ページ

公開時に `{{version}}` と `{{date}}` を置き換えます。

## 商品名

TaltoConv（非公式TALTO移行ヘルパー）

## 価格

0円

## 商品説明

テキスト・Markdown・pixiv小説形式・HTMLを、TALTOへ貼り付けやすい形に変換する非公式ツールです。見出し・注釈・太字・下線・空行を整えます。

- 原稿は端末内だけで処理し、外部へ送信・保存しません
- WindowsはZIP、iPhone・iPad・AndroidはWeb版を使います
- ホーム画面に追加したWeb版はオフラインでも起動できます
- TALTOへの貼り付け、画像挿入、保存確認は手作業です
- 画像ファイルは読み込まず、挿入位置に「【画像：…】」を残します

### Windows

1. ZIPを展開
2. `TaltoConv.html` をEdgeまたはChromeで開く
3. 変換結果をコピーし、TALTOへ貼り付ける

### iPhone・iPad・Android

SafariまたはChromeでWeb版を開き、「ホーム画面に追加」してください。

**https://chicken1q84.github.io/TaltoConv/**

Androidは制作者の手元に実機がなく、未検証です。

### 対応環境

- Windows 11 25H2：Edge 153 / Chrome 153以降
- iPhone・iPad：iOS 27 / iPadOS 27のSafari
- Android 17：Chrome 153以降（実機未検証）

2026年9月17日時点。古いOS、アプリ内ブラウザ、上記以外のブラウザは動作保証外です。

### 注意

- 元の原稿は必ず別に保管し、最初は短い原稿で試してください
- TALTO側の仕様変更により、変換結果が変わる可能性があります
- 利用によるデータ消失・表示崩れ・保存失敗などについて、制作者は責任を負いません
- TaltoConvは個人制作で、TALTOおよび運営元とは関係ありません

MIT License / ソースコード：https://github.com/chicken1q84/TaltoConv

バージョン：v{{version}}（{{date}}）
連絡先：[@chicken1_skin](https://x.com/chicken1_skin)

## ダウンロードファイル

`TaltoConv_v{{version}}.zip`（Windows用）
