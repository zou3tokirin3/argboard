---
id: T097
title: updateCard を部分更新（patch）に変更する
status: done
owner: none
gate: human
branch: task/T097
template_ver: generic-0.2
created: 2026-10-26
updated: 2026-10-27
---

## 目的

T082設計検討の結論①②を実装する。
`updateCard` を「変えた項目だけ受け取る」形に変更し、上書きバグの根本原因を除く。
T083（タイトル直し上書きバグ）もこの変更で根治される。

## 背景

現在の `updateCard` は `title/body/url` を必ず全部受け取る。
stream から呼ぶとき「タイトルだけ変えたのに body/url も渡す」状態で、
debounce タイミングが重なると古い値で上書きが起きる（T083の実害あり）。

## やること

### 1. `updateCard` シグネチャ変更（`state.ts`）

```ts
type CardPatch = Partial<{
  title: string;
  body: string;
  url: string;
  storyWhen: string;
  storyUntil: string;
  ogpImage: string | null;
}>;

async function updateCard(id: string, patch: CardPatch): Promise<void>
```

実装上の必須ルール（T082設計相談より）：
- `undefined` キーをそのまま spread しない（既存値が消える）
- **await より前に** 最新メモリ状態へ同期的にマージする
- 正規化後に現在値と同じなら no-op（イベントもスキップ）
- 空 title が来た場合は title だけ無視し、他項目は反映する
- 保存キューは**プロジェクト単位**で直列化する（カード単位では不十分）

### 2. 呼び出し元を更新

| ファイル | 変更内容 |
|---|---|
| `inspector.tsx` | dirty なフィールドだけ patch に含める（現在は全項目渡し） |
| `stream.tsx` | `{ title: next }` だけ渡す（`body`・`url` を渡すのをやめる） |

### 3. 型エラーが出た箇所を修正

`check` が緑になるまで対処する。

## 受け入れ条件

- [x] `updateCard` の型が `CardPatch` を受け取る形になっている
- [x] stream でタイトルを変えた後、Inspector を開いても本文・URL が消えない
- [x] Inspector で入力中に stream でタイトルを変えても、Inspector の入力が上書きされない（T083 再現手順で確認）
- [x] 最新コミットで check / test が緑（smoke は main でも同一箇所でタイムアウト・要再確認）
- [ ] 人間が動作確認する

## このカードでやらない

- Inspector・stream の保存タイミング変更（→ T098）
- `state.ts` の分割（→ T099）
- Esc 統一（→ T100）

## 作業ログ（追記のみ）

- 2026-10-26 planner: T082設計相談（外部AI2件）の結論を受けて起票。T083同時解決
- 2026-10-26 impl: task/T097 で CardPatch・cardUpdateChain・リプレイ部分適用を実装。review へ
- 2026-10-27 human: PR #2 のマージを承認（人間ゲート）。履歴再生のずれ（旧ビルドで空にした body/url が JSON 書き出し→読み込み後に viewThrough で残る）は別カードに切り出す指示
- 2026-10-27 agent: origin/main（smoke 修正 #3）を取り込み、check / test（102 pass）/ build / smoke（1 passed）すべて緑。smoke のタイムアウトは #3 で解消済み。APP_RELEASE 0.81→0.82。PR #2 を squash merge し task/T097 を削除して done
- 2026-10-27 agent: 受け入れ条件「stream でタイトル変更後も本文・URL が残る」「T083 再現手順」を argboard開発 がブラウザ自動操作（Playwright・録画あり）で確認済み（2026-10-27）。隆さんが録画を見てマージを承認

## 差し戻し履歴（追記のみ）
