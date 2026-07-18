---
id: T009
title: JSONインポートでプロジェクトを完全復元する
status: review
owner: impl
gate: auto
branch: "task/T009"
template_ver: generic-0.2
created: 2026-07-13
updated: 2026-07-18
---

## 目的

片道のJSONエクスポートを、実際に復元できる保存契約へ完成させる。
T008で核体験が成立した後、外部利用・長期運用より前に完了する。

## 受け入れ条件

- [x] ヘッダーからversion 1のProject JSONを選択して読み込める
- [x] 元データを上書きせず、新しいidの新規プロジェクトとして取り込む
- [x] cards（roleを含む）/ links（通常・要検討を含む）/ boards / positions / viewport / uiを復元する
- [x] 不正JSON・未対応versionでは既存データを変更せず、利用者へエラーを示す
- [x] export→importの往復で同等データへ復元できる
- [x] 既存smoke④を往復検証へ置き換え、シナリオ総数は5本以内を維持する
- [x] 最新コミットで check / test / smoke が緑

## 作業ログ（追記のみ）

- 2026-07-13 planner: M3の最優先を完全復元へ絞って起票。depends on T008
- 2026-07-16 planner: 純増上限を100→70へ（枠をT013へ。PLAN §4）
- 2026-07-16 planner: 純増上限を70→50へ（探索行アクション分をT013へ）
- 2026-07-18 planner: T008/T014完了。受け入れ条件が揃っているため ready
- 2026-07-18 impl: 取得。task/T009 worktree で JSONインポート（完全復元）を実装する
- 2026-07-18 impl: 着手。基準行数2,929・純増上限50行。parse+新規id取り込み+ヘッダー読込
- 2026-07-18 impl: 完了→review。純増50行(2,929→2,979)。3be2536 で check/test/smoke 緑
- 2026-07-18 human: 同名プロジェクトが多く切替で何を見ているか分からない
- 2026-07-18 impl: 取り込み名に（取り込み）付与、セレクトに枚数・時刻を表示。本体2,992行（T009累計+63/上限50超・review指摘対応）

## 差し戻し履歴（追記のみ）
