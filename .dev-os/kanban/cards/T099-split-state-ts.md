---
id: T099
title: state.ts を責務ごとに分割する
status: backlog
owner: none
gate: human
branch: ""
template_ver: generic-0.2
created: 2026-10-26
updated: 2026-10-26
---

## 目的

T082設計検討の結論③を実装する。
1758行・123 export の `state.ts` を責務ごとに分割し、読みやすく変更しやすくする。

## 背景

触るたびに全体を読む必要がある。T037（board.tsx のドラッグ切り出し）と同じ型の問題。

## 分割方針

依存は一方向のみ（下の層は上の層を import しない）：

```
types.ts（変更なし）
    ↑
store.ts       … project / cards / links のシグナル定義だけ（外部 import なし）
    ↑
selection.ts   … selectedCardId / selectedCardIds / clearCardSelection など
filter.ts      … search / unplacedOnly / findingOnly など（computed 含む）
replay.ts      … isReplaying / enterReplay / clearReplay など
    ↑
dig.ts         … diggingCardId / startDigging / stopDigging / captureSourceCard
    ↑
state.ts（残留）… カード・リンク CRUD・プロジェクト操作
```

### 注意事項（設計相談より）

- barrel 経由の循環を作らない（内部モジュール同士は実体を直接 import）
- `state.ts` を re-export 窓口として残す場合、内部は窓口を使わない
- プロジェクト切り替え・カード削除などの「複数責務をまたぐ操作」は上位で調停する
- 分割後に `madge --circular` 等で循環がないことを確認する

## 受け入れ条件

- [ ] 各ファイルの責務が1つになっている
- [ ] 循環 import がない（`madge --circular` または手動確認）
- [ ] 既存の import パスを変えていない（barrel 経由の互換を維持するか、全呼び出し元を更新する）
- [ ] 最新コミットで check / test / smoke が緑
- [ ] 人間が採択する

## このカードでやらない

- Esc 統一（→ T100）
- 新しい状態の追加・API 変更

## 依存

- T097・T098 完了後に着手する（保存経路の整理が先）

## 作業ログ（追記のみ）

- 2026-10-26 planner: T082設計相談の結論を受けて起票

## 差し戻し履歴（追記のみ）
