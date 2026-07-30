---
id: T049
title: OGP取得と共有プレビューをDeno Deployで足す
status: backlog
owner: none
gate: human
branch: ""
template_ver: generic-0.2
created: 2026-07-30
updated: 2026-07-30
---

## 目的

Web系ARG向けに、出典URLのメタデータ（og:title 等）取得と、ボードURL共有時の
リッチプレビューを可能にする。静的ホスト（GitHub Pages）では CORS により不可（§12 Won't）。

出典: 2026-07-30 人間との設計相談（「今は不要だが入れたい。Web ARG と相性良い」）
優先度: できたら。Deno Deploy 移行（または API のみ Deploy）の第一歩候補。
T027（既出出典サジェスト）より先でも後でも可 — 別スコープ（外部 fetch vs プロジェクト内 url 一覧）

## 背景（起票時メモ）

- §13: サーバー機能の拡張候補として OGP 取得・共有リンクを Deno Deploy に記載済み
- UI（`dist/`）は GitHub Pages のまま、API だけ Deploy に載せる構成も可
- キャプチャ時: 貼った url からタイトル候補を返す（手入力の補助。自動確定はしない）
- 共有時: プロジェクト／ボード URL の og:image / og:title を動的生成（範囲は ready 時に確定）
- Entity辞書・出典マスタは作らない（§12）

## 受け入れ条件（起票時ドラフト・ready時に確定）

- [ ] Deno Deploy 上に OGP プロキシ API があり、指定 URL の og:title（最低限）を返せる
- [ ] キャプチャまたはインスペクタから利用でき、失敗時は従来どおり手入力のみで邪魔しない
- [ ] 静的 UI の配布経路（Pages 等）と API の CORS が整合する
- [ ] flow しきい値を意識し、超過見込みなら評価パケットへの人間GOが作業ログにある
- [ ] 最新コミットで check / test / smoke が緑
- [ ] 人間が「出典入力または共有プレビューが Web ARG 向けに楽になった」と確認する

## このカードでやらない

- 共同編集・同期・クラウド保存（§12 Won't。別途 v2）
- 出典マスタ・名寄せ・Entity辞書
- T027 の既出 url サジェスト（プロジェクト内候補。必要なら連携は後続）
- GitHub Pages 本線の廃止（Deploy は API または任意の第二配布先）

## 作業ログ（追記のみ）

- 2026-07-30 planner: 起票。§12 Won't の「将来拡張」を backlog 化。Web ARG 向け OGP を人間が将来入れたい意向

## 差し戻し履歴（追記のみ）
