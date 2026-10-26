---
id: T098
title: Inspector・stream の保存を「確定時のみ・変更項目だけ」に統一する
status: backlog
owner: none
gate: human
branch: ""
template_ver: generic-0.2
created: 2026-10-26
updated: 2026-10-26
---

## 目的

T082設計検討の結論①を実装する（T097の後に行う）。
各入力欄が「確定したとき（blur/Enter/debounce）に変えた項目だけを送る」形に揃える。

## 背景

T097で `updateCard` が部分更新対応になった後、呼び出し側の保存タイミングを整理する。
設計相談で指摘された毎キー即保存の問題（IME・Escキャンセル・書き込みコスト）を解消する。

## やること

### Inspector（`inspector.tsx`）

- **旧**: カード切り替え時に `dirtyFieldsRef` の全項目を一括 flush
- **新**: 各フィールドが独立して確定（blur/Enter/debounce）したとき、そのフィールドだけ送る
- `dirtyFieldsRef` は残す（フォーカス中の欄を外部更新で書き換えないための保護に使う）
- IME 変換中（`isComposing`）は送らない

### stream のタイトル編集（`stream.tsx`）

- 「確定」: blur / Enter → `updateCard(id, { title: draft })`
- 「Escキャンセル」: draft を破棄、`updateCard` を呼ばない（現在の仕様を維持）
- 400ms debounce は維持してよい（毎キー保存にはしない）

## 受け入れ条件

- [ ] 日本語 IME で変換中に保存が走らない
- [ ] stream でタイトル編集中に Esc を押すと、編集前の値に戻る（updateCard が呼ばれない）
- [ ] Inspector でフィールド編集中に他画面が同じカードを変更したとき、フォーカスしていない欄だけ即座に更新される
- [ ] 最新コミットで check / test / smoke が緑
- [ ] 人間が「入力がちゃんと保存される・IMEが壊れない」を確認する

## このカードでやらない

- `state.ts` の分割（→ T099）
- Esc 統一（→ T100）

## 依存

- T097 完了後に着手する

## 作業ログ（追記のみ）

- 2026-10-26 planner: T082設計相談の結論を受けて起票

## 差し戻し履歴（追記のみ）
