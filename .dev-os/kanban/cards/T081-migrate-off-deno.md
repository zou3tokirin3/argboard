---
id: T081
title: Deno ツールチェーンから離れる（親）
status: done
owner: none
gate: human
branch: ""
template_ver: generic-0.2
created: 2026-10-16
updated: 2026-10-20
---

## 目的

Deno ランタイムの公式開発終了（Deploy 停止・ランタイム保守終了の見込み）を受け、argboard の
**ビルド・開発・検証ループを Deno 依存から外す**方針を PLAN に残し、後続の調査・置き換えチケットへ
つなぐ親カード。本カードでは実装・リポジトリの置き換えは行わない。

出典: 2026-10-16 リポジトリ作者（隆さん）依頼。背景の正本は PLAN §14 改訂30。

## 受け入れ条件

- [ ] ユーザー意図が PLAN §14 決定ログ（改訂30）に読める
- [ ] 後続で「移行先調査」「ビルド/開発ループ置き換え」等の子チケットを切る（本カードではスコープを書かない）

## このカードでやらない

- `deno.json` / mise / smoke ループの実際の置き換え（後続カード）
- Won't（§12）の解除や OGP・共同編集の技術確定
- Deno Deploy 前提カード（例: T049）の本文の一括改稿（必要なら子チケットで）

## 作業ログ（追記のみ）

- 2026-10-16 planner: 起票（backlog）。意図の記録のみ。§14 改訂30 と同期

- 2026-10-20 planner: 移行プランを `.dev-os/plans/cloudflare-migration.md` に作成（提案・採択待ち）。子カードはプラン §3〜§5 を出典に、採択後に起票する

- 2026-10-20 human: 移行プランを採択。planner: フェーズAを T085 として起票
- 2026-10-21 claude: フェーズB（T086〜T091）完了。deno.json/serve.ts/smoke.ts 削除。pnpm run build/check/test/smoke 全緑。done。

## 差し戻し履歴（追記のみ）
