---
id: T004
title: M2 ボードで糸を張れるようにする
status: review
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

- [x] ストリームからボードへカードをドラッグ配置できる
- [x] ボード上でカード間をドラッグして糸（connects / contradicts）を作成できる
- [x] 糸にラベルを付けられる
- [x] パン・ズームが操作できる
- [x] テストフック経由で E2E が安定（固定 sleep 禁止・§10-3 準拠）
- [x] スモーク E2E が緑

## 作業ログ（追記のみ）

- 2026-07-12 planner: 受け入れ条件・gate 確認済み → ready
- 2026-07-12 impl: 取得。task/T004 worktree でボード配置・糸張り・パンズームを本線にする
- 2026-07-12 impl: worktree は `.worktrees/T004`（規約の `../argboard--T004` は既存方針に合わせる）
- 2026-07-12 impl: 配置/糸/パンズーム・リンク編集・テストフック・smoke ②③を追加（`9901229`）
- 2026-07-12 impl: check/test/smoke 緑。task/T004 を main へ merge → review

## 差し戻し履歴（追記のみ）
