---
id: T004
title: M2 ボードで糸を張れるようにする
status: doing
owner: impl
gate: auto
branch: "task/T004"
template_ver: generic-0.2
created: 2026-07-12
updated: 2026-07-12
---

## 目的

M2: ストリーム→ボードへの配置、パン/ズーム、ドラッグで糸を張りラベルを付けられるようにする。
baseline のボードは静的表示のみ（デモ links / positions 固定）。

## 受け入れ条件

- [ ] ストリームからボードへカードをドラッグ配置できる
- [ ] ボード上でカード間をドラッグして糸（connects / contradicts）を作成できる
- [ ] 糸にラベルを付けられる
- [ ] パン・ズームが操作できる
- [ ] テストフック経由で E2E が安定（固定 sleep 禁止・§10-3 準拠）
- [ ] スモーク E2E が緑

## 作業ログ（追記のみ）

- 2026-07-12 planner: 受け入れ条件・gate 確認済み → ready
- 2026-07-12 impl: 取得。task/T004 worktree でボード配置・糸張り・パンズームを本線にする
- 2026-07-12 impl: worktree は `.worktrees/T004`（規約の `../argboard--T004` は既存方針に合わせる）

## 差し戻し履歴（追記のみ）
