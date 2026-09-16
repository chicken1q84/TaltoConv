TaltoConv（非公式TALTO移行ヘルパー）
====================================

バージョンは画面下部と TaltoConv_files/VERSION.txt に表示されます。変更内容は TaltoConv_files/CHANGELOG.txt を参照してください。

このパッケージは、内容を人間が確認・修正しやすいように、
画面・見た目・変換規則・形式定義・画面操作を別ファイルに分けています。
実行に必要なファイルのほか、テスト・設計資料・ローカル表示用のスクリプトも同梱しています。

■ 起動方法

このフォルダにある「TaltoConv.html」をダブルクリックし、
Microsoft EdgeまたはGoogle Chromeで開いてください。触るのはこのファイルだけです。

「TaltoConv_files」フォルダには動作に必要なファイルがまとめて入っています。
中身を移動・削除・改名しないでください。TaltoConv.html と同じ場所に置いたまま使います。

ブラウザの制限でコピーできない場合は、画面の「自動コピーがうまくいかない場合」から手動でコピーできます。
それでも難しい場合は、TaltoConv_files フォルダで「node tools/serve.mjs」を実行し、
表示されたローカルURLを開いてください（Node.js 22以降が必要。通常の利用には不要です）。

iPhone・iPad・AndroidではこのZIPではなく、Web版をSafariまたはChromeで開いて「ホーム画面に追加」してください。
一度開けば、次回からはネット接続なしで起動できます。
  Web版: https://chicken1q84.github.io/talto-migration-helper/

■ 対応する原稿

貼り付け：プレーンテキスト、CommonMark、GFM、Obsidian Markdown、pixiv小説形式、HTML
ファイル／フォルダ：.md、.markdown、.html、.htm、.txt

ファイル名からMarkdown方言やpixiv形式を自動判定しません。
複数ファイルを上から下へ結合し、画面の「02 形式」で選んだ1種類として読み取ります。
画像ファイル自体は読み込まず、対応する画像参照だけを文字として残します。

■ ファイルの役割

TaltoConv.html
  これをダブルクリックして起動します。画面の構造と表示する項目を定義しています。

はじめにお読みください.txt
  この説明書です。

TaltoConv_files/
  動作に必要なファイルと、改修する人向けの資料です。通常の利用では開く必要はありません。

  TaltoConv_単一ファイル版.html
    CSSとJavaScriptを1つに埋め込んだ予備版です。TaltoConv.html が開けない場合や、
    HTMLを1ファイルだけ別の場所へ持ち出したい場合に使えます。動作は通常版と同じです。

  src/styles/app.css
    色、余白、ボタン、入力欄、PC・スマホ表示など、見た目を定義します。

  src/scripts/converter.js
    Markdown、Obsidian、pixiv、HTMLをTALTO向けに変換します。

  src/scripts/format-catalog.js
    原稿形式ごとの対応識別子、残すもの、簡略化・除外するものを定義します。

  src/scripts/app.js
    ボタン操作、ファイル読み込み、設定保存、プレビュー、コピーなど、画面上の動作を定義します。

  tests/
    変換規則の回帰テスト、配布物の構造テスト、ランダム入力テストです。
    TaltoConv_files フォルダで実行します。
    node tests/test-converter.cjs
    node tests/test-structure.cjs
    node tests/fuzz-converter.cjs

  tools/serve.mjs
    このPCだけに配信する小さなローカルサーバーです。外部へは公開しません。

  docs/
    MIGRATION_GUIDE.md  TALTOへの移行手順と変換仕様
    ARCHITECTURE.md     ファイル構成と、変更したい内容ごとの編集場所
    COMMENTING_PLAN.md  コメントの書き方の方針

  VERSION.txt / CHANGELOG.txt / LICENSE.txt
    バージョン、変更履歴、ライセンス（MIT）です。

■ 修正後の確認

ブラウザを再読み込みしてください。
以前のJavaScriptやCSSが残る場合は、Ctrlキーを押しながらF5キーを押してください。

変換規則を変更した場合は、上記のテストを実行して結果が変わっていないか確認してください。

最初は短い原稿で確認し、次に「対応識別子のテスト原稿」を使って、
原稿欄の識別子と確認画面の表示を見比べてください。

■ 使用上の注意

このツールは変換専用で、原稿を管理・編集するエディタではありません。
元の原稿は必ず別に保管してください。

本ツールは個人が制作した非公式ツールであり、TALTOおよびその運営元とは関係ありません。
本ツールの利用によって生じたデータの消失、表示崩れ、保存失敗、
その他の損害について、制作者は一切の責任を負いません。

連絡先：https://x.com/chicken1_skin
