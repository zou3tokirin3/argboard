---
id: T094
title: 掘る際の階層をパンくずリストで表示する
status: done
owner: none
gate: none
branch: ""
template_ver: generic-0.2
created: 2026-10-23
updated: 2026-10-23
---

## 目的

多段掘り（カードから掘って、さらにその子カードから掘る）をしたとき、
Capture フォーム上部の掘り中バーに今いる階層がわかるよう表示する。

「掘った順の履歴」ではなく、カードの `foundVia` チェーンを辿った
実際の親子構造を表示する。

## 実装内容

- `CaptureDiggingBar` を `foundVia` チェーンを辿るパンくずリストに変更
  - 先祖カードはボタン → クリックで `startDigging(card.id)` に切り替え
  - 末端（現在掘り中）は `<strong>` で太字表示
  - `[×]` ボタンで全停止（従来通り）
- `startDigging` 呼び出し時に `clearCardSelection()` を実行
  - 掘るボタンを押したら右パネルが Inspector から Capture フォームに切り替わる

## 作業ログ（追記のみ）

- 2026-10-23 claude: `CaptureDiggingBar` を `foundVia` チェーン方式に実装。`startDigging` 内で `clearCardSelection()` を呼ぶよう変更。CSS に `.capture__digging-crumb / -sep / -back` を追加。
- 2026-10-23 human: done 確認。
