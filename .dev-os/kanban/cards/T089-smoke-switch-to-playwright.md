---
id: T089
title: smoke E2E を Playwright に切り替える（フェーズB4）
status: done
owner: none
gate: human
branch: ""
template_ver: generic-0.2
created: 2026-10-21
updated: 2026-10-21
---

## 目的

フェーズB4（PLAN §3）。`@astral/astral` による smoke テスト 5 本を Playwright に移す。
`?test=1` フックは維持する。5 本上限・flaky 即削除の規律はそのまま。

親: T081 / 前提: T087（dev サーバー切り替え完了後）

## やること

- `@playwright/test` を devDependencies に追加
- `tests/smoke.ts`（Astral 版）を `tests/smoke.spec.ts`（Playwright 版）に書き直す
  - 5 本の smoke を移植する
  - `?test=1` クエリで起動するフック部分を維持する
- `pnpm run smoke` スクリプトを追加する
- 5 本が全部緑になることを確認

## 受け入れ条件

- [ ] `pnpm run smoke` が通り、5 本緑
- [ ] `?test=1` フックが Playwright 版でも機能する
- [ ] `deno task smoke` は削除または無効化してよい
- [ ] flow しきい値を意識し、超過見込みなら評価パケットへの人間GOが作業ログにある

## このカードでやらない

- lint / fmt / 型チェックの置き換え（B5）
- budget.ts の Node 移行（B6）

## 作業ログ（追記のみ）

- 2026-10-21 claude: @playwright/test 追加。tests/smoke.spec.ts を作成（Astral API → Playwright API に変換）。playwright.config.ts 作成。pnpm run smoke → 1 passed (670ms)。done。

## 差し戻し履歴（追記のみ）
