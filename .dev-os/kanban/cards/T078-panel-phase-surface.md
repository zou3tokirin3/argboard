---
id: T078
title: 考察を唯一の作業面にし、発見ログを広い／レール／閉じるの3段にする
status: review
owner: impl
gate: human
branch: "task/T078"
template_ver: generic-0.2
created: 2026-10-08
updated: 2026-10-08
---

## 目的

[T076](T076-contemplate-panel-phase.md) 採択どおり、探索／考察のモードタブをやめ、
**考察ボードを唯一の作業面**にする。発見ログは左パネルの幅3段
（`wide` / `rail` / `closed`）でフェーズを表す。

出典: T076 採択（2026-10-08 人間「実装してみて」）

関連: [T076](T076-contemplate-panel-phase.md) / [T005](T005-explore-contemplate-modes.md) /
[T016](T016-relieve-narrow-viewport.md) / [T053](T053-explore-stream-inline-edit.md) /
[T045](T045-explore-image-paste.md) / [T073](T073-person-lane-timeline-view.md) / PLAN §7

## 背景（起票時メモ）

- 探索と考察は順番の工程ではなく往復。モード切替よりパネル幅がフェーズ
- 常時半分ずつの2ペインには戻さない
- 作中並び（T073）はフォーカス隣のまま

### ready 確定

1. **地面**＝考察ボード常時。モードタブなし
2. **panelPhase**＝`wide` | `rail` | `closed`（`ui.mode` + `sideOpen` を置き換え）
3. **wide**＝画像ペースト／ステージング・タイトル直編集・大きめプレビュー。ボードは端に見える
4. **rail**＝いまの 360px サイド。キャプチャ＋ストリーム＋ボード DnD
5. **closed**＝ボード全面。トグルで戻れる
6. **移行**＝`mode==="explore"` → `wide`；`contemplate`+`sideOpen` → `rail`；閉じ → `closed`
7. **既定**＝新規プロジェクトは `wide`（若いプロジェクト）
8. **ボード保護**＝カード選択でインスペクタが意味を持つとき、`wide` なら `rail` へ落とす
9. **外す**＝`ExploreWorkspace` 専用レイアウト、モードタブ、`AppMode` 永続

## 受け入れ条件

- [x] モードタブがなく、地面は常に考察ボードである
- [x] 発見ログを広い／レール／閉じるに切り替えられる
- [x] 広い段で画像ペースト・タイトル直編集・大きめプレビューができる
- [x] 広い／レールのどちらからでも発見ログをボードへドラッグ配置できる
- [x] カードを選ぶと広い段はレールへ落ち、ボードが極端に潰れない
- [x] 既存 `explore` 保存プロジェクトは次回 `wide` で開く
- [x] 作中並び（T073）はフォーカス隣のまま動く
- [x] PLAN §7 が考察主面＋panelPhase に同期されている
- [x] 見込み flow: 本体 +150〜250 / 操作 −1〜+1 / 概念 +1 / gzip 中 / Won't=No。超過ならパケットGO
- [x] check / test / smoke が緑
- [ ] 人間が「モード切替なしで材料を足してボードに置ける」と確認する

## 確認観点（gate: human のとき）

表示: タブ・左上が **`ARGBoard · 0.68+T078`**（review 中）であること。

- [ ] モードタブがない。広いパネルから材料を足し、そのままボードへ置ける
- [ ] パネルをレール／閉じにしても、トグルでキャプチャと発見ログに戻れる
- [ ] ボードからカード選択で広い→レールになり、ボードが読める
- [ ] 作中並びはフォーカス隣から開く
- [ ] 再読込後も panelPhase が残る。旧 explore プロジェクトは wide で開く

## このカードでやらない

- 常時半分ずつの2ペイン
- 発見／考察 role 統合
- T073 / T075 の中身変更
- T016 の全面レイアウト再設計（wide→rail 落としでボード保護のみ）

## 作業ログ（追記のみ）

- 2026-10-08 planner: T076 採択を受け実装カード起票→ready。見込み flow 上記
- 2026-10-08 impl: 取得。task/T078 worktree で panelPhase 実装する
- 2026-10-08 impl: 実装完了（400b17b）。モードタブ撤去・常時ボード・panelPhase 3段・
  wide に画像ペースト／タイトル直編集・ボード選択で wide→rail・旧 explore→wide 移行・
  PLAN §7 同期・APP_PREVIEW=T078。実測 Δ本体行 +98 前後（15 files +328/−230）/
  操作 タブ−2＋phase+1 程度 / 概念 +1（panelPhase）/ gzip 中 / Won't=No。
  check/test/smoke 緑 → review

## 差し戻し履歴（追記のみ）
