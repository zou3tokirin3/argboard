---
id: T009
title: JSONインポートでプロジェクトを完全復元する
status: backlog
owner: none
gate: auto
branch: ""
template_ver: generic-0.2
created: 2026-07-13
updated: 2026-07-13
---

## 目的

片道のJSONエクスポートを、実際に復元できる保存契約へ完成させる。
T008で核体験が成立した後、外部利用・長期運用より前に完了する。

## 受け入れ条件

- [ ] ヘッダーからversion 1のProject JSONを選択して読み込める
- [ ] 元データを上書きせず、新しいidの新規プロジェクトとして取り込む
- [ ] cards（roleを含む）/ links（通常・要検討を含む）/ boards / positions / viewport / uiを復元する
- [ ] 不正JSON・未対応versionでは既存データを変更せず、利用者へエラーを示す
- [ ] export→importの往復で同等データへ復元できる
- [ ] 既存smoke④を往復検証へ置き換え、シナリオ総数は5本以内を維持する
- [ ] 最新コミットで check / test / smoke が緑

## 作業ログ（追記のみ）

- 2026-07-13 planner: M3の最優先を完全復元へ絞って起票。depends on T008
- 2026-07-16 planner: 純増上限を100→70へ（枠をT013へ。PLAN §4）
- 2026-07-16 planner: 純増上限を70→50へ（探索行アクション分をT013へ）

## 差し戻し履歴（追記のみ）
