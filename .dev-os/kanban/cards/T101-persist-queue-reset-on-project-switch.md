---
id: T101
title: プロジェクト切り替え時に persist キューをリセットする
status: backlog
owner: none
gate: human
branch: ""
template_ver: generic-0.2
created: 2026-10-26
updated: 2026-10-26
---

## 目的

プロジェクト切り替え時に、前のプロジェクトの未保存分が失われる競合リスクを取り除く。

## 背景・問題

`persist()` のキューは `saveChain`（モジュールレベルの Promise）で直列化されているが、
プロジェクト切り替え時にリセットされない。

**競合の再現シナリオ：**
1. プロジェクトAを編集中 → `persist()` のキューが積まれている（drain待ち）
2. ユーザーがBに切り替え → `activateProject(B)` が `project.value = B` にセット
3. Aのキューが後から drain → `project.value`（今はB）を読んでBを保存
4. **Aへの最新版保存が走らない** → Aの最後の数編集が消える

通常操作では発生しにくい（切り替えまでに drain が完了することが多い）が、
重い操作（画像添付・大量カード）の直後に切り替えると踏む可能性がある。

## やること

`activateProject()` の `project.value = next` を設定する前に：

1. `saveDirty` フラグをリセットする
2. `saveChain` を完了まで待つ（または強制フラッシュして旧プロジェクトを確実に保存する）

```ts
// activateProject 内での修正イメージ
async function activateProject(next: Project): Promise<void> {
  // 旧プロジェクトの pending 保存を flush してから切り替え
  await saveChain;
  saveDirty = false;

  // ここから新プロジェクトの処理
  project.value = next;
  // ...
  await store.saveProject(opened);
}
```

ただし `saveChain` は現在モジュール内 `let` なので、参照方法を確認して調整する。

## 受け入れ条件

- [ ] プロジェクトAで大量編集直後にBへ切り替えても、Aの変更が失われない
- [ ] 切り替え後にBの保存キューが正常に動作する
- [ ] 最新コミットで check / test / smoke が緑
- [ ] 人間が確認する

## このカードでやらない

- `persist()` の設計変更
- マルチタブ対応（別問題）

## 依存

- T097（updateCard 部分更新）完了後でよい

## 作業ログ（追記のみ）

- 2026-10-26 planner: state.ts の直接 saveProject 呼び出し調査中に発見。直接呼び出し自体は意図的だが、切り替え時の競合リスクがあることが判明。

## 差し戻し履歴（追記のみ）
