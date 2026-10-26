---
id: T100
title: Esc キーを単一ハンドラーに集約する
status: backlog
owner: none
gate: human
branch: ""
template_ver: generic-0.2
created: 2026-10-26
updated: 2026-10-26
---

## 目的

T082設計検討の結論④を実装する。
4ファイルに分散した Esc 処理を、優先順位の明確な単一ハンドラーに集約する。

## 背景

現在 `inspector.tsx` / `image-overlay.tsx` / `stream.tsx` / `main.tsx`（2か所）に
Esc ハンドラーが分散している。優先順位が暗黙で、将来レイヤーが増えると管理できなくなる。

## やること

### 優先順位（UIレイヤー順）

1. IME 変換中は何もしない（`isComposing` チェック必須）
2. 最前面のオーバーレイ（image-overlay など）
3. レイヤー内の一時メニュー・編集（Inspector 内部 etc.）
4. 通常画面の編集キャンセル（stream タイトル編集）
5. 掘削・選択・パネルの解除

### 実装方針

- 各機能は「閉じる/キャンセル処理」を関数として所有する
- 中央（`main.tsx` または専用ファイル）が「誰に渡すか」だけを決める
- **1回の Esc で 1つだけ処理**する（背後のレイヤーを連鎖で閉じない）
- 処理した場合は `e.preventDefault()` を呼ぶ
- 既存のグローバル Esc リスナーはすべて撤去する

```ts
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || e.isComposing || e.defaultPrevented) return;
  const handled = dispatchEscToTopmostLayer();
  if (handled) e.preventDefault();
});
```

## 受け入れ条件

- [ ] Esc ハンドラーが1か所で管理されている
- [ ] IME 変換中に Esc を押してもパネルが閉じない
- [ ] オーバーレイが開いているとき Esc で閉じる（選択は解除されない）
- [ ] stream タイトル編集中に Esc でキャンセルできる（T098 と整合）
- [ ] 最新コミットで check / test / smoke が緑
- [ ] 人間が各 Esc の動きを確認する

## 依存

- T098 完了後に着手する（各機能の「閉じる処理」が確定してから）

## 作業ログ（追記のみ）

- 2026-10-26 planner: T082設計相談の結論を受けて起票

## 差し戻し履歴（追記のみ）
