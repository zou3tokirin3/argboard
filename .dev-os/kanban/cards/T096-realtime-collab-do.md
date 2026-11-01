---
id: T096
title: 同時オンライン編集（Cloudflare DO + WebSocket）
status: doing
owner: argboard開発
gate: human
branch: task/T096-collab-slice1
template_ver: generic-0.2
created: 2026-10-23
updated: 2026-11-01
---

## 背景

現在のデータはブラウザの IndexedDB にのみ保存される（サーバーなし）。
複数人が同じプロジェクトを同時に編集するには、サーバー側の状態管理が必要。

§12 Won't リストの「共同編集・同期」に該当するため、**Won't 解除の判断を先に行う**。

## 受け入れ条件（2026-10-31 人間決定・grill-me 9問すべて「おすすめ」）

決定の原文（開発マネージャー経由）: 「argboardの共同編集やる。argboard開発に質問を立ててもらって答える」（22:39 JST）、「argboard共同編集の9問は全部おすすめでいい」（22:42 JST）。

| # | 問い | 決定 |
|---|---|---|
| 1 | 誰と使うか | 2〜5人の決まった仲間 |
| 2 | 同時か交代か | 同時に触れて、相手の変更がすぐ見える |
| 3 | 入り方 | 招待リンクを知っている人だけ入れる。アカウントなし |
| 4 | リンクでできること | リンクを持つ全員が編集できる（閲覧専用リンクは作らない） |
| 5 | サーバに置くデータ | 共有するボードだけ Cloudflare に置く。共有しないボードは今どおりブラウザ内だけ |
| 6 | 画像 | 最初は文字とつながりだけ。画像（添付）の共有は後回し |
| 7 | 接続が切れたとき | 手元で編集を続けられ、つながったら合流する |
| 8 | 最初の版の大きさ | 「1つのボードを2人で同時に触れる」だけを作って試す |
| 9 | 費用 | Cloudflare 無料枠だけ。超えたら止まってよい |

- [ ] 招待リンクを開いた2つのブラウザで、同じボードのカード追加・編集・移動・削除とつながりの変更が、もう片方に数秒以内に反映される
- [ ] 片方をオフラインにして編集し、オンラインに戻すと両方の編集が失われずに合流する
- [ ] 共有していないボードはサーバへ送られない（通信を見て確認）
- [ ] 添付画像は共有されない（共有ボードで画像があっても壊れず、相手側では画像なしで見える）
- [ ] アカウント・ログイン画面がない
- [ ] Cloudflare Workers 無料プラン（SQLite 版 Durable Objects）だけで動く。有料プラン前提の設定がない
- [ ] 既存の check・test・build・smoke が通る
- [ ] 人間が2つのブラウザで動作確認する

### 費用見積もり（Cloudflare 公式料金ページ 2026-10-18 更新版から計算・実測前）

無料枠は1日あたりリクエスト 10万・書き込み 10万行・保存 合計5GB。超えるとその日（09:00 JST リセット）は止まり、請求はない。
5人が毎日2時間、1人2秒に1回編集する想定で、メッセージ約1.8万通 → 課金上は20通で1リクエストなので約900リクエスト、書き込みは多めに見て約1.8万行。無料枠の1〜2割。

### 進め方

- T101（プロジェクト切り替え時の保存のずれ）を先に片づけてから着手する
- 1 PR 400行程度に分ける。最初の PR は「1ボード2人同時」の最小版

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
- 2026-10-31 argboard開発: grill-me 9問を開発マネージャー経由で人間に提出。全問「おすすめ」で決定。受け入れ条件を記入し backlog→ready。§12 Won't 解除は PLAN §14 改訂31。
- 2026-11-01 writer（task/T096-collab-slice1）: 最初の共同編集実装。依存追加なし、コミット・push・外部通信なし。CRDT は使わず、SQLite DO の採番済み set 操作と WebSocket Hibernation で中継。共有していない Project は通信しない。share.pending は既存 Store 経由で保存し、画像・events・ui・viewport は操作に含めない。zip の project.json から share を除外し、取り込みでも share を破棄。
  - 確定状態と pending の重ね合わせを分離。hello の履歴末尾を空の ops フレームで通知。pending がある保存データを開き直す場合、最初の hello(since=share.seq) の後に hello(since=0) で確定状態を復元し、ack 済みを除いて再送する。ドラッグ確定は最後に保存した状態との差分から位置操作を作る。
  - 招待は 128bit base64url room、トップバー「共有」とコピー可能な招待リンク、接続/オフライン/同期エラー表示。既存 room のローカル Project を再利用し、join hash を消す。Worker は room/Origin/Upgrade を検証。サーバ検証・採番は偽サーバと共通の純関数。256KiB/500操作/50,000操作上限、oid 重複排除、画像除去を実装。SQLite migration の new_sqlite_classes のみ使用。
  - 検証: 指定 COREPACK_HOME を設定し、ローカルの Node 22.23.4 とキャッシュ済み pnpm 10.15.0 で pnpm check/test/build が成功。全 unit ファイルの直接実行も 121 件成功（新規12件）。pnpm smoke は既存1本を変更せず実行したが Chromium 起動で sandbox_host_linux.cc:41 / shutdown: Operation not permitted。起動オプションを変えた再試行も同じ失敗。アプリ操作には未到達であり smoke 通過・実ブラウザ2人確認・Cloudflare 実機確認は未完了。受け入れチェックは人間確認まで変更しない。
  - 差分規模: docs を除き追加533行（テスト込み894行）、削除3行。400行の目安は超過。今回は指定の最小同期・永続化・必須入力検証を含め、画像共有・履歴圧縮・専用の共有管理UIは次PR以降。上限超過時は削除や圧縮を行わずエラーを表示して pending を保持する。
- 2026-11-01 argboard開発: ready→doing（owner argboard開発、branch task/T096-collab-slice1）。最初の PR は「1ボード2人同時」の最小版。書き手 Codex、レビューは別モデル（Cursor クラウドエージェント）。取り次ぎ側で再検証: check/test(121)/build/smoke 緑（上の smoke 失敗は Codex サンドボックス内の Chromium 起動制限によるもので、サンドボックス外では通過）。`wrangler dev`（ローカル Worker+SQLite DO）＋ Playwright 2ブラウザで、追加・移動・つながり追加/ラベル・改名が数十 ms で反映、サーバ停止中に両側で編集→B のタブを閉じて開き直し→再起動で合流し両者一致を確認。非共有プロジェクトでは WebSocket が開かないことを確認。証跡 /workspace/argboard-t096/（box 内）。
- 2026-11-01 argboard開発: PR #8 レビュー1回目（Cursor クラウドエージェント）はブロッキングなし。取り次ぎ側の2ブラウザ確認で見つけた「開いているタブで招待リンクを開くと参加しない（hashchange）」を Codex が修正。あわせてフレーム集約（最大500操作/フレーム）、share 除去を parseProjectJson に集約、src/ を biome 対象に、同期テスト追加（135件）。再検証: check/test/build/smoke 緑、wrangler dev＋2ブラウザで反映・オフライン合流・タブ再オープン後の合流を確認。
- 次 PR 以降に回す（レビュー1回目の非ブロッキング指摘）: 同一フィールド・タグ配列の同時編集は後勝ち（タグの和集合マージ）、events（履歴）は共有されずリプレイが人ごとに分かれる、ドラッグ中にリモートの位置で上書きされうる、Origin なし/null の扱い、GitHub Pages 版では共同編集できないことの明記、招待リンクの専用 UI（今は prompt）と共有の停止、boards[0] だけが共有対象、ルーム上限 50,000 操作と操作ログ圧縮、sync 層の位置づけ（PLAN §6）、画像共有、人間による2ブラウザ確認。
- 2026-11-01 argboard開発: PR #8 レビュー2回目（Cursor クラウドエージェント、a7230e4）もブロッキングなし。非ブロッキングで次 PR に回すもの: DO の hello/配信フレームにも 256KiB のバイト上限分割、1操作が 256KiB を超えたときの文言、hashchange 参加の重入防止、参加・切り替え前の保存フラッシュ（デバウンス中の編集の取りこぼし防止）、export の share 除去を共通関数に。status は doing のまま（done・APP_RELEASE はマージ時）。マージは隆さんの OK 待ち。
