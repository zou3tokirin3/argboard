# BOOTSTRAP — この開発に参加するAIへ

template_ver: generic-0.2
正本: `~/.agents/dev-os`（テンプレ本体。触らない。改善案は正本の `retro/queue.md` へ1行）

この `.dev-os/` がこのプロジェクトの盤面。ここを読めば参加できる。

## 読む順

1. このファイル
2. `kanban/_board.md` — 盤面の掟（列・遷移・owner・worktree）
3. `roles/` の自分の役割ファイル
4. 担当カード（`kanban/cards/`）

## 自分の役割の決まり方

役割（planner / impl / reviewer）は、人間またはあなたを起動した指示が指定する。
**指定がなければ勝手に選ばない。** 人間に尋ねて止まる。

## このプロジェクトの固有情報（adopt/new 時にAIが記入する）

- 概要: [README.md](../README.md) / 仕様は [PLAN.md](../PLAN.md) が唯一の正本
- セットアップ / ビルド / テスト:
  - 前提: `mise install`（Deno 2 は [mise.toml](../mise.toml)）
  - 開発: `mise exec -- deno task dev`
  - 検証ループ: `mise exec -- deno task check && mise exec -- deno task test && mise exec -- deno task smoke`
  - ビルド成果物: `dist/`（GitHub Pages 公開用）
- 触ってはいけない場所:
  - `PLAN.md` の Won't リスト（§12）に書かれた機能は提案・実装しない
  - 本体予算: 15 ファイル / 3,000 行は警告基準（§11-3）。超過見込みは評価パケット→人間GO
  - スモーク E2E は 5 本上限・flaky 即削除（§10-2）
- 人間が特に確認したい領域（該当カードは `gate: human`）:
  - デザイン・世界観（M0-a: 「毎日触りたい」判定）
  - マイルストーン境界のドッグフーディング（§9）
  - GitHub Pages 公開 URL の実機確認

## 迷ったとき

- カードは動かさず、カードの「作業ログ」に質問を1行追記して止まる
- 盤面の掟とプロジェクト固有指示が矛盾したら、人間ゲートに委ねる

## 痛点を見つけたら

`~/.agents/dev-os/retro/queue.md` に1行追記する。このプロジェクト内では直さない。
