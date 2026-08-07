---
id: T055
title: 発見ログの絞り込みに発見のみ・考察のみを足す
status: done
owner: impl
gate: human
branch: ""
template_ver: generic-0.2
created: 2026-08-05
updated: 2026-08-07
---

## 目的

発見ログの絞り込み帯（未配置のみ／配置済のみ／ツリーと並ぶ **選択メニュー**）に、
**発見のみ**・**考察のみ**（人間要望では「探索のみ」「思考のみ」）を足す。
role で見分けたい場面（考察だけ並べ替えたい、発見だけザクザク確認したい等）を、
考察モードへの切替なしで済ませる。

出典: 2026-08-05 人間要望（選択メニューに探索のみ・思考のみもほしい）／
[T038](T038-tag-visibility-and-stream-filters.md)・[T047](T047-stream-placed-filter.md) で後回しにした role 軸の回収。

## 背景（起票時メモ）

- カード種別は `card.role`: 省略＝`finding`（発見）、`thought`（考察）— [T012](T012-distinguish-findings-and-thoughts.md)
- UI ラベルは「発見／考察」。人間の「探索／思考」との対応は **ready 時に表記を確定**（混同しやすいので注意）
- 既存: `unplacedOnly` / `placedOnly` は排他トグル、`filteredCards` で AND — [T040](T040-stream-unplaced-filter.md) / [T047](T047-stream-placed-filter.md)
- 配置軸と role 軸は **独立トグル**想定（例: 未配置 × 考察のみ）。同時仕様は ready で確定
- 罠: 「発見のみ」「考察のみ」同士も排他にするか（三方目「全部」＝両方OFF）を決める
- 罠: ツリー表示（T051）・検索・タグ視点（T033）との AND が壊れないこと
- 最小案: `stream__filters` にボタン2つ、`findingOnly` / `thoughtOnly` session 信号、JSON 非永続

## 受け入れ条件（起票時ドラフト・ready 時に確定）

- [x] 発見ログの絞り込み帯に **発見のみ**（または確定ラベル）と **考察のみ** を追加できる
- [x] ON のとき `card.role` で一覧が絞れる（省略 role は finding 扱い）
- [x] 発見のみ／考察のみの排他ルールが決まり、UI と `filteredCards` が一致する
- [x] 未配置のみ・配置済のみ・検索・タグ視点・ツリーと **AND** で併用できる
- [x] トグル状態は session のみ（エクスポート JSON に載せない）
- [x] flow しきい値の見込みを作業ログに書く。超過見込みならパケットへの人間GOがある
- [x] check / test / smoke が緑
- [x] 人間が「探索だけ／思考（考察）だけ見たい」が選択メニューで足りると確認する

## このカードでやらない

- タグ単位の一覧絞り（T038 後回しのまま）
- ボード側の role フィルタ／カード非表示
- フィルタ状態の永続化（プロジェクト JSON / localStorage）
- role の自動推定や入力時仕分けの変更（T044 の再分類 UI は維持）

## 作業ログ（追記のみ）

- 2026-08-05 human: 選択メニューに探索のみ・思考のみがほしい → 起票（T055）
- 2026-08-05 planner: T038/T047 後回しの role 軸。表記は ready で「探索↔発見」「思考↔考察」を確定
- 2026-08-07 impl: `findingOnly` / `thoughtOnly` session 信号・排他トグル・`filteredCards` AND 絞り込みを実装。UI ラベルは「発見のみ／考察のみ」。check/test/smoke 緑 → review
- 2026-08-07 human: 発見のみ／考察のみで探索だけ・考察だけ見たい用途が足りる確認OK → done

## 差し戻し履歴（追記のみ）
