---
id: T086
title: ビルドを esbuild に切り替える（フェーズB1）
status: done
owner: none
gate: human
branch: ""
template_ver: generic-0.2
created: 2026-10-21
updated: 2026-10-21
---

## 目的

フェーズB1（PLAN §3）。`deno bundle` を `esbuild` に置き換え、`dist/` が同等に出るようにする。
`deno bundle` と並走して差分比較する。

親: T081 / 前提: T085（採択済み 2026-10-21）

## やること

- `package.json` を作成し、`esbuild`・`preact`・`@preact/signals` を登録する
- `scripts/build.js`（または `build.mjs`）を書く
  - `ui/main.tsx` を `dist/bundle.js` に出力
  - `index.html`・`styles.css`・`manifest.json`・`sw.js`・`dist/icons/` もコピー
  - JSX: `--jsx=automatic --jsx-import-source=preact`
- `pnpm run build` で `dist/` が出ることを確認
- `deno task build` と `pnpm run build` を両方走らせて出力サイズを比較（差は +1.3 KB gzip 以内が目安）
- `deno task build` は **まだ消さない**（並走期間）

## 受け入れ条件

- [ ] `pnpm run build` が通り `dist/bundle.js` が出る
- [ ] gzip サイズが現行（63,436 B）から +8 KB 以内
- [ ] ブラウザで `dist/index.html` を開いてアプリが起動する
- [ ] `deno task build` も引き続き通る（並走確認）
- [ ] flow しきい値（本体行 +200 / 操作 +3 / 概念 +2 / gzip +8KB / Won't）を意識し、超過見込みなら評価パケットへの人間GOが作業ログにある

## このカードでやらない

- dev サーバーの置き換え（B2）
- unit / smoke / lint / 型チェックの置き換え

## 作業ログ（追記のみ）

- 2026-10-21 claude: package.json・scripts/build.js 作成。pnpm run build → 298.5KB / gzip 63,818B（+382B）。deno task build も並走確認済み。done。

## 差し戻し履歴（追記のみ）
