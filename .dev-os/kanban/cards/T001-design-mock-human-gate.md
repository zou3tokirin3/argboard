---
id: T001
title: デザインモックの合格判定を得る
status: review
owner: none
gate: human
branch: ""
template_ver: generic-0.2
created: 2026-07-12
updated: 2026-07-12
---

## 目的

M0(a) の完了条件「自分が毎日触りたいと思える」を人間が判定する。
`dc8a961` baseline に捜査ボード風 UI とダミーデータが入っている。

## 受け入れ条件

- [ ] `mise exec -- deno task dev` で localhost を開き、見た目・雰囲気を確認した
- [ ] 「毎日触りたい」と言える / 言えない の判断を作業ログに残した
- [ ] NG の場合は差し戻し理由（具体箇所）を差し戻し履歴に追記して rework へ

## 作業ログ（追記のみ）

- 2026-07-12 planner: baseline コミット時点の UI を review へ。人間のドッグフーディング待ち

## 差し戻し履歴（追記のみ）
