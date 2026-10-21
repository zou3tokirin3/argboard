---
id: T087
title: dev サーバーを置き換える（フェーズB2）
status: done
owner: none
gate: human
branch: ""
template_ver: generic-0.2
created: 2026-10-21
updated: 2026-10-21
---

## 目的

フェーズB2（PLAN §3）。`serve.ts`（`Deno.serve`）を Node ベースの簡易 dev サーバーに置き換える。
ブランチ名をタイトルに出す機能は維持する。

親: T081 / 前提: T086（ビルド切り替え完了後）

## やること

- `serve.ts` の役割を整理する
  - `dist/` を静的配信
  - ブランチ名をタイトルへ埋め込む（`git branch --show-current`）
- Node 代替を実装する（`node:http` または `wrangler dev` を使う）
  - `wrangler dev` が `dist/` を配信できるなら、それを dev サーバーとして使うのが最も軽い
- `pnpm run dev` で起動し、手元でアプリが開けることを確認

## 受け入れ条件

- [ ] `pnpm run dev` で起動し `http://localhost:<port>` でアプリが開ける
- [ ] ブランチ名がタイトルに表示される
- [ ] `deno task dev` は削除または無効化してよい（serve.ts が不要になる）
- [ ] flow しきい値を意識し、超過見込みなら評価パケットへの人間GOが作業ログにある

## このカードでやらない

- unit / smoke / lint / 型チェックの置き換え
- `deno task build` の削除（B1 以降の並走を維持）

## 作業ログ（追記のみ）

- 2026-10-21 claude: scripts/serve.js を作成（node:http。ブランチ名タイトル埋め込み維持）。curl確認: タイトル・CSS配信・キャッシュバスター・404すべて正常。pnpm run dev スクリプト追加。done。

## 差し戻し履歴（追記のみ）
