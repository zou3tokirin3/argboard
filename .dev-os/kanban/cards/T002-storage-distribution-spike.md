---
id: T002
title: IndexedDB 保存と GitHub Pages 配布を確認する
status: ready
owner: none
gate: auto
branch: ""
template_ver: generic-0.2
created: 2026-07-12
updated: 2026-07-12
---

## 目的

M0(b) の保存・配布スパイクを完了する。コードは `ui/db.ts` / `ui/state.ts` に原型あり。

## 受け入れ条件

- [ ] Chrome と Safari の 2 ブラウザで、手がかり追加 → リロード後も残ることを確認
- [ ] 初回カード作成時に `navigator.storage.persist()` が呼ばれる（DevTools で確認可）
- [ ] `deno task build` の `dist/` を GitHub Pages に公開し、別端末（または別プロファイル）で URL を開いて動作確認
- [ ] `deno task check && deno task test && deno task smoke` が緑

## 作業ログ（追記のみ）

- 2026-07-12 planner: smoke は Astral で capture→保存→reload を検証済み（ローカル）。ブラウザ実機と Pages 公開が未了

## 差し戻し履歴（追記のみ）
