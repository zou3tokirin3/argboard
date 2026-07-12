---
id: T003
title: M1 ザクザク体験を完成させる
status: review
owner: impl
gate: auto
branch: "task/T003"
template_ver: generic-0.2
created: 2026-07-12
updated: 2026-07-12
---

## 目的

M1: 3 秒で 1 枚放り込め、リロードしても消えない、プロジェクト切替と JSON エクスポートが使える状態にする。
baseline に capture / stream / export の原型あり。デモプロジェクト固定は M1 完了条件を満たさない。

## 受け入れ条件

- [x] 入力 1 行 + Enter でカードがストリーム先頭に追加される
- [x] 初回保存時に `persist()` を要求する
- [x] プロジェクト作成・切替ができる（M2 までは 1 ボード固定で可）
- [x] ヘッダーの JSON エクスポートが 1 クリックでダウンロードできる
- [x] スモーク E2E が緑（5 本上限内）

## 作業ログ（追記のみ）

- 2026-07-12 planner: 受け入れ条件・gate 確認済み → ready
- 2026-07-12 impl: 取得。task/T003 worktree でプロジェクト作成・切替を本線にする
- 2026-07-12 impl: worktree は `.worktrees/T003`（規約の `../argboard--T003` は既存方針に合わせる）
- 2026-07-12 impl: プロジェクト select/新規・activeId・空プロジェクト生成を追加。smoke に切替シナリオを足した（`5562529`）
- 2026-07-12 impl: check/test/smoke 緑。task/T003 を main へ merge → review

## 差し戻し履歴（追記のみ）
