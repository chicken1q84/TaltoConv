# talto_ReDesign — 作業規約

この企画は `talto/migration-helper-v2` の **ReDesign**（見た目と操作を磨く別リポジトリ）。scope・状態・取り込み手順は [REDESIGN.md](REDESIGN.md)。作業台共通の規約は `D:\Coding\AGENTS.md`。

- 機能追加・仕様変更をしない。バグ修正は `fix:` コミットで分ける
- dev server は 8766（`.claude/launch.json` の `redesign-source`）。e2e は `PORT=8766 npm run test:e2e`
- 撮影の設定は `vqa.json`（routes / steps）。出力 `.vqa/` はコミットしない

<!-- design-rules:start -->
## UI 作業の運用ルール

- UI を追加・変更する前に `PRODUCT.md` と `DESIGN.md` を読む。DESIGN.md に無い色・フォント・角丸・影を新しく作らない。
- 既存のコンポーネント・CSS カスタムプロパティを優先する。頼まれていない全面リデザインはしない。
- 新規画面や初期コンセプトを作るときだけ `frontend-design` Skill を使う。既存画面の修正では使わない。
- UI 変更が終わったら `/visual-qa` を実行する（1440 / 768 / 390 を一括撮影 → design-reviewer → 一括修正 → 最終確認 → codex-review）。
- Visual QA → 修正は原則 1 回、最大 2 回。3 回目は機能障害がある場合のみ。
- レビュー指摘は「足す」より「引く」を先に検討する（要素・装飾・文言の重複を減らす）。
- 参照画像（`references/`）は雰囲気の抽象化に使い、色やレイアウトを写さない。
<!-- design-rules:end -->
