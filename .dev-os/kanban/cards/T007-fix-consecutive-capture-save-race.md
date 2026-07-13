---
id: T007
title: 連続キャプチャでカードを失わないようにする
status: doing
owner: impl
gate: auto
branch: "task/T007"
template_ver: generic-0.2
created: 2026-07-13
updated: 2026-07-13
---

## 目的

初回 `requestPersistence()` の応答待ち中に複数カードを追加すると、古いProject全体の保存で
後発カードが失われる競合を直す。M2.5のP0であり、他の機能追加より先に完了する。

## 受け入れ条件

- [ ] `requestPersistence()` の完了待ちがカードのオンメモリ反映をブロックしない
- [ ] 初回persist応答を遅延させ、2件を連続追加しても両方がオンメモリに残る
- [ ] 保存完了後にreloadしても2件とも残る
- [ ] 古いProjectスナップショットが新しい状態を後から上書きしない
- [ ] 既存smoke①を「2件連続追加→reload→両方残る」へ強化し、シナリオ総数は5本以内を維持する
- [ ] 最新コミットで check / test / smoke が緑

## このカードでやらない

- 500msデバウンスの新規導入
- JSONインポート、toast、PWA
- T006の糸種別UI変更

## 作業ログ（追記のみ）

- 2026-07-13 planner: 方針レビューで再現したデータ消失をP0として起票
- 2026-07-13 planner: 目的・受け入れ条件・auto gate・非スコープを確認 → ready

- 2026-07-13 impl: 着手。保存競合（requestPersistence待機中の連続追加）を直す

## 差し戻し履歴（追記のみ）
