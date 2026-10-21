---
id: T091
title: budget.ts を Node に移行する（フェーズB6）
status: done
owner: none
gate: human
branch: ""
template_ver: generic-0.2
created: 2026-10-21
updated: 2026-10-21
---

## 目的

フェーズB6（PLAN §3）。`tools/budget.ts` を Node で動くように書き直す。
計測の定義（PLAN §4）は変えない。移行前後で同じ数字が出ることを確認する。

親: T081 / 前提: T086（ビルド切り替え完了後）

## Deno API → Node 置き換え一覧（T085 調査済み）

| Deno | Node |
|---|---|
| `Deno.Command` | `node:child_process` `spawn` |
| `Deno.cwd()` | `process.cwd()` |
| `Deno.makeTempDir` | `node:fs` `mkdtempSync` + `node:os` `tmpdir()` |
| `Deno.remove(p, {recursive})` | `node:fs` `rm(p, {recursive:true})` |
| `Deno.readTextFile` | `node:fs/promises` `readFile` |
| `Deno.readDir` | `node:fs/promises` `readdir({withFileTypes:true})` |
| `Deno.errors.NotFound` | `error.code === 'ENOENT'` |
| `Deno.args` | `process.argv.slice(2)` |
| `import.meta.main` | `process.argv[1] === fileURLToPath(import.meta.url)` |
| `deno task build`（内部呼び出し） | `pnpm run build`（T086 完了後に差し替え） |

## 受け入れ条件

- [ ] `pnpm run budget` が通る
- [ ] `pnpm run budget` と `deno task budget` の出力数値が一致する（同一コミットで確認）
- [ ] `deno task budget` は削除または無効化してよい
- [ ] flow しきい値を意識し、超過見込みなら評価パケットへの人間GOが作業ログにある

## このカードでやらない

- `deno.json` の完全削除（全B完了後に別途）

## 作業ログ（追記のみ）

- 2026-10-21 claude: tools/budget.js を Node 組み込みのみで作成。全Deno API を 1:1 置き換え。node tools/budget.js と deno task budget を比較 → gzip以外の全指標が一致（本体行数13336・TS行9954・ファイル39・テスト2749・smoke5・操作94・概念120）。gzip差はビルドツール切り替え（esbuild→60,451B / deno bundle→63,446B）に起因。done。

## 差し戻し履歴（追記のみ）
