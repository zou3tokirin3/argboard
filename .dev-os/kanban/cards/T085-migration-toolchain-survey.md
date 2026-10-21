---
id: T085
title: Deno の代わりに使うツールを調べて選ぶ
status: done
owner: none
gate: human
branch: ""
template_ver: generic-0.2
created: 2026-10-20
updated: 2026-10-20
---

## 目的

移行プラン フェーズA（`.dev-os/plans/cloudflare-migration.md` §3）。
Deno のビルド・開発・検証ループを置き換えるツールを選び、**評価パケットで人間の採択を取る**。
本カードでは置き換えの実装はしない（フェーズBの子カードで1つずつ行う）。

出典: 2026-10-20 人間が移行プランを採択（親: T081）

## 決めること

| 論点 | 候補 |
|---|---|
| 実行・パッケージ管理 | Node + pnpm（mise で固定） |
| バンドラ／dev サーバー | esbuild 単体 / Vite |
| unit | `node:test` / Vitest |
| スモークE2E | Playwright（PLAN §13 記載済み） |
| fmt / lint | Biome / Prettier + ESLint |
| 型チェック | `tsc --noEmit`（`.ts` 拡張子 import の扱いを確認） |
| Deno 延命 | コミュニティ継続の状況を確認し、選択肢として残すか決める |

判断軸: 依存の少なさ（PLAN §11-7）／今のループ（check→test→smoke・budget）をそのまま再現できるか／
Cloudflare（wrangler）との相性。

## 受け入れ条件

- [ ] 上の各論点に、採る候補と理由が1〜3行で書いてある
- [ ] 小さな試作で、`ui/main.tsx` が候補のバンドラで `dist/` に出ることを確かめている（試作は捨ててよい）
- [ ] `tools/budget.ts` を Node で動かすときの難所（`Deno.Command` など）が洗い出してある
- [ ] 追加される依存の一覧と数が評価パケットにある
- [ ] Deno の公式発表の日付（Deploy 停止・ランタイム終了）を一次情報で確認し、プランの「目安」を更新している
- [ ] 人間が評価パケットを採択する

## このカードでやらない

- `deno.json`・`serve.ts`・CI・テストの実際の置き換え（フェーズBの子カード）
- Cloudflare への一本化（フェーズC）
- Durable Objects（フェーズD）

## 作業ログ（追記のみ）

- 2026-10-20 human: 移行プランを採択（「移行プランも良いわ」）
- 2026-10-20 planner: フェーズAとして起票（backlog）
- 2026-10-21 claude: 調査・試作を実施。評価パケット `.dev-os/kanban/packets/T081-a.md` を作成。
  - Deno 公式タイムライン確認（2026-10-09 買収発表。Deploy +6ヶ月≒2027-04、ランタイム終了 +1年≒2027-10）
  - esbuild 試作: `ui/main.tsx` のビルド成功（13ms、gzip 64.7KB）。.ts 拡張子 import も問題なし
  - budget.ts の Deno API を棚卸し。全項目 Node 組み込みで置き換え可能
  - 追加 devDependencies 3本（esbuild・biome・typescript）
  - Node vs Bun を比較検討。pnpm ルール競合・wrangler 公式サポートの観点から Node に決定（human 確認済み）
  - 人間の採択待ち（T081-a.md の採択欄）

## 差し戻し履歴（追記のみ）
