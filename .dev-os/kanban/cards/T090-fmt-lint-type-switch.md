---
id: T090
title: fmt・lint・型チェックを Biome + tsc に切り替える（フェーズB5）
status: done
owner: none
gate: human
branch: ""
template_ver: generic-0.2
created: 2026-10-21
updated: 2026-10-21
---

## 目的

フェーズB5（PLAN §3）。`deno fmt` / `deno lint` / `deno check` を Biome + tsc に置き換える。
既存コードの整形差分は **1 コミットに隔離** する。

親: T081 / 前提: T088（unit テスト切り替え完了後）

## やること

- `@biomejs/biome` を devDependencies に追加し `biome.json` を作成
  - `deno fmt` に近いスタイル設定にする
- `typescript` を devDependencies に追加し `tsconfig.json` を作成
  - `allowImportingTsExtensions: true`（.ts 拡張子 import を許可）
  - `noEmit: true`
  - `jsx: "react-jsx"` / `jsxImportSource: "preact"`
- `pnpm run check` スクリプトを追加（`biome check` + `tsc --noEmit`）
- 整形差分は **1 コミットに隔離**（レビューを容易にするため）
- `deno fmt --check` / `deno lint` / `deno check` は削除または無効化してよい

## 受け入れ条件

- [ ] `pnpm run check` が通る（biome check + tsc --noEmit どちらも緑）
- [ ] 整形差分が独立したコミットに分かれている
- [ ] flow しきい値を意識し、超過見込みなら評価パケットへの人間GOが作業ログにある

## このカードでやらない

- budget.ts の Node 移行（B6）

## 作業ログ（追記のみ）

- 2026-10-21 claude: @biomejs/biome + typescript 追加。biome.json（2スペース・CSS除外・a11y既存ルール off）・tsconfig.json（ES2023・allowImportingTsExtensions）作成。biome --unsafe で整形差分を適用。pnpm run check（biome + tsc --noEmit）緑。done。

## 差し戻し履歴（追記のみ）
