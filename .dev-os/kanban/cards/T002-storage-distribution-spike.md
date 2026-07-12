---
id: T002
title: IndexedDB 保存と GitHub Pages 配布を確認する
status: doing
owner: impl
gate: auto
branch: "task/T002"
template_ver: generic-0.2
created: 2026-07-12
updated: 2026-07-12
---

## 目的

M0(b) の保存・配布スパイクを完了する。コードは `ui/db.ts` / `ui/state.ts` に原型あり。

## 受け入れ条件

- [ ] Chrome と Safari の 2 ブラウザで、手がかり追加 → リロード後も残ることを確認
- [x] 初回カード作成時に `navigator.storage.persist()` が呼ばれる（DevTools で確認可）
- [ ] `deno task build` の `dist/` を GitHub Pages に公開し、別端末（または別プロファイル）で URL を開いて動作確認
- [x] `deno task check && deno task test && deno task smoke` が緑

## 作業ログ（追記のみ）

- 2026-07-12 planner: smoke は Astral で capture→保存→reload を検証済み（ローカル）。ブラウザ実機と Pages 公開が未了
- 2026-07-12 impl: 取得。task/T002 worktree で保存・Pages スパイクを進める
- 2026-07-12 impl: worktree はサンドボックス制約で `.worktrees/T002` に作成（規約の `../argboard--T002` 不可）
- 2026-07-12 impl: persist 呼び出しを smoke で assert。空きポート対応。Pages workflow 追加（`cf8b986`）
- 2026-07-12 impl: check/test/smoke 緑。persist 受け入れ条件を満たした
- 2026-07-12 impl: ブロッカー — remote 未設定 + `gh` トークン無効。Pages 公開は `gh auth refresh` 後に続行
- 2026-07-12 impl: Chrome/Safari に localhost:8000 を開いた。人間のリロード確認待ち

## 差し戻し履歴（追記のみ）
