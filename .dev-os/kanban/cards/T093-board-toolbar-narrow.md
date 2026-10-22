---
id: T093
title: board__toolbar が右パネル幅拡張で狭くなる問題
status: backlog
owner: none
gate: human
branch: ""
template_ver: generic-0.2
created: 2026-10-22
updated: 2026-10-22
---

## 目的

T084 でパターンB（右パネル 520px）を導入した結果、`contemplate-main` のボード列が狭くなり、
`board__toolbar` のレイアウトが崩れるようになった。

具体的な現象:
- 「メインボード」と「2件の手がかり」が縦並びに潰れる
- ヒントテキスト（「糊付け帯をドラッグで移動…」）がはみ出す
- 考察インライン入力（`board__thought`）が窮屈

出典: 2026-10-22 T084 パターンB 動作確認中の人間フィードバック（スクリーンショット #7）

関連: T084（右パネル）

## やりたいこと（アイデア段階）

- パターンBのとき `board__toolbar` でヒントテキストを非表示にする（または tooltip に逃がす）
- board 名 + カード数を1行に収める（font-size 調整 or truncate）
- 考察インライン入力の flex 動作を narrow 対応にする

## このカードでやらない

- ボード列の幅変更（T084 が定義した 520px は維持）
- `board__thought` の機能変更

## 作業ログ（追記のみ）

- 2026-10-22 human: T084 パターンB で board__toolbar が狭くて崩れると指摘。T084 スコープ外として別チケットに切り出し。
