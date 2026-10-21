---
id: T088
title: unit テストを node:test に切り替える（フェーズB3）
status: done
owner: none
gate: human
branch: ""
template_ver: generic-0.2
created: 2026-10-21
updated: 2026-10-21
---

## 目的

フェーズB3（PLAN §3）。`deno test` を `node:test` に置き換える。20本のテストが全部緑になること。

親: T081 / 前提: T086（ビルド切り替え完了後）

## やること

- `tests/unit/*.test.ts` 全 20 本の `Deno.test(name, fn)` を
  `import { test } from "node:test"; test(name, fn)` に書き換える
- assert は全ファイル `throw new Error(...)` のみ使用 → 変更不要
- `pnpm run test` スクリプトを追加する（`node --test tests/unit/*.test.ts` など）
- 全 20 本が緑になることを確認

## 受け入れ条件

- [ ] `pnpm run test` が通り、20 本全部緑
- [ ] `deno test` は削除または無効化してよい
- [ ] flow しきい値を意識し、超過見込みなら評価パケットへの人間GOが作業ログにある

## このカードでやらない

- smoke E2E の置き換え（B4）
- lint / fmt / 型チェックの置き換え（B5）

## 作業ログ（追記のみ）

- 2026-10-21 claude: 全20ファイルの `Deno.test` → `test`（node:test）を一括置換。`t.step` → `t.test` 修正1件。pnpm run test → 100本全部緑。done。

## 差し戻し履歴（追記のみ）
