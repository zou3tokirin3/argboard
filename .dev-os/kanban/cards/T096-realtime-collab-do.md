---
id: T096
title: 同時オンライン編集（Cloudflare DO + WebSocket）
status: backlog
owner: none
gate: Won't解除が必要（§12）
branch: ""
template_ver: generic-0.2
created: 2026-10-23
updated: 2026-10-23
---

## 背景

現在のデータはブラウザの IndexedDB にのみ保存される（サーバーなし）。
複数人が同じプロジェクトを同時に編集するには、サーバー側の状態管理が必要。

§12 Won't リストの「共同編集・同期」に該当するため、**Won't 解除の判断を先に行う**。

## やりたいこと（アイデア段階）

- Cloudflare Durable Objects (DO) を WebSocket ハブとして使い、複数クライアント間でボードの差分を中継する
- ストレージ層は §6 の `db.ts` 契約を守り、同期エンジン（CRDT 系: Yjs / Automerge 等）に差し替える
- `wrangler.jsonc` に Worker の設定を追加し、静的アセット配信と同一オリジンで動かす

## 技術候補（確定前）

| 層 | 候補 |
|---|---|
| 同期プロトコル | Yjs + y-websocket / Automerge |
| ハブ | Cloudflare DO（WebSocket 永続接続） |
| 永続化 | DO の Storage API / Cloudflare D1 |

## このカードでやること（Go が出たら）

1. Won't 解除の判断・ユースケース確認
2. 技術選定パケット作成（Yjs vs Automerge、DO の料金試算）
3. `db.ts` の差し替えプロトタイプ（ローカル動作確認）
4. Worker + DO の設定追加（`wrangler.jsonc`）
5. CI/CD を GitHub Pages から Cloudflare Pages + Workers に移行（→ T097 として分離可）

## 前提チケット

- T081 done（Node 移行完了で Cloudflare 寄せの下地ができた）
- T049（OGP プロキシ）: 同様に Deno Deploy → Cloudflare Worker 前提の見直しが必要

## 作業ログ（追記のみ）

- 2026-10-23 human: 同時オンライン編集をやりたい。DO 使うことになるか、と検討。backlog として起票。
