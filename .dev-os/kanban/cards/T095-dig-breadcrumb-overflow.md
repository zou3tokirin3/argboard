---
id: T095
title: 掘るパンくずリストが深くなると画面外にはみ出る
status: done
owner: none
gate: none
branch: ""
template_ver: generic-0.2
created: 2026-10-23
updated: 2026-10-23
---

## 問題

T094 で実装した掘る階層パンくずリスト（`CaptureDiggingBar`）は、
階層が深くなると `.capture__digging` の横幅を超えてはみ出す。

出典: 2026-10-23 スクリーンショット #19

## やりたいこと（アイデア段階）

- 中間の先祖を `…` に省略して最初と最後だけ表示（例: `A › … › D`）
- もしくは全体を `overflow: hidden; text-overflow: ellipsis` でクリップしつつ
  hover / tap でフル展開
- 縦方向に折り返してもよいかもしれない（デザイン検討）

## このカードでやらないこと

- パンくずの表示ロジック自体の変更（T094 で確定済み）

## 作業ログ（追記のみ）

- 2026-10-23 human: 階層が深いとはみ出すと指摘。backlog として起票。
- 2026-10-24 AI: chain.length > 2 のとき `[root] › … › [current]` に折りたたむよう capture.tsx を修正。`…` の CSS クラス `.capture__digging-ellipsis` を追加。
