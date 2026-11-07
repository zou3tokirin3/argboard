# argboard 引き継ぎ 2026-11-07（T098 / T103）

作業用のローカル領域がなくても続けられるように書いた引き継ぎ。認証情報・セッション・生ログは含まない。
時刻はすべて JST。Obsidian Sync の状態は未確認なので、同期済みとは書いていない。

## 状態（2026-11-07 16:27 JST に GitHub で確認）
- PR #9（T098 の1本目）https://github.com/zou3tokirin3/argboard/pull/9 : 2026-11-07 16:26:57 JST にマージ済み。merge commit `e098106`、head `9fda3a7`
- #9 マージ直後の main = `e098106`。両デプロイ success（coordinator 確認記録）: [Workers](https://github.com/zou3tokirin3/argboard/actions/runs/42351325351) / [Pages](https://github.com/zou3tokirin3/argboard/actions/runs/42351325436)
- 公開版はどちらも `"0.84"`: https://argboard.zou3tokirin3.workers.dev/ と https://zou3tokirin3.github.io/argboard/
- docs-only PR #10 はマージ済み。phase2 はその後の `e73cb07` を基点に作業。T098 は `status: review` / `gate: human`、release は `0.84` を維持（done・bump なし）
- 2本目（stream 側）: 実装・別AIレビュー・確認録画は 13:14 と 14:03 の承認の範囲内で、16:26 に開発マネージャーから続行の指示も出ている。**マージだけは隆さんの別承認が必要**。phase2 は新しいブランチで stream タイトルだけを実装する。snapshot（`93f9654`）は参考のみで、Inspector の再実装はしない

## 隆さんの承認（原文と範囲）
| 時刻 JST | 原文 | 範囲 |
|---|---|---|
| 13:14 | 「T098は6項目ともおすすめで進めて。マージは別に確認して」 | 仕様のみ |
| 13:28 | 「必要な開発環境を復元してT098を進めて。ログインが必要ならそこで止めて。マージは別確認」 | 環境の復元と実装 |
| 14:03 | 「T098は提案どおり2本のPRに分けて、不具合を直して進めて。どちらもマージは別確認」 | 2本に分けること、B1 の修正、両PRの実装・レビュー・録画（マージは別承認） |
| 16:25 | 「T098第1のPR #9をマージしていい。第2は引き続き別確認」 | #9 のマージだけ。2本目のマージは別承認（実装は進めてよい） |
| 14:06 | 「argのやつ、各種ワード気に入らないとか、外国語対応で簡単に差し替え可能にできる？」→「相談して決めて、人間いじらずAIがやる」 | T103 の設計相談（設計の決定は隆さんの委任により開発マネージャーが 14:07 に行った） |
| 14:08 | 「別カードにしておいて」 | T103 のカード作成だけ。実装とマージは未承認 |
| 16:26 | 「じゃあ、引き継ぎできる状態にしておいて」 | この引き継ぎ資料 |

## T098 の仕様（6項目、おすすめで確定）
1. debounce を廃止する。保存は blur か Enter のときで、変更した欄だけを送る。IME で変換中の Enter では確定しない
2. カードを切り替える直前に、未確定の欄を元のカードへ強制保存する
3. 共同編集では、編集中の欄は守る。それ以外の欄と、確定した後の欄には相手の値を反映する
4. 一覧のタイトル編集中に Esc を押したら、変更を捨てて保存しない（debounce の待ちも取り消す）
5. 対象は title / url / body / storyWhen / storyUntil / 糸ラベル。タグとサイズは今までどおり即時保存する
6. gate: human のまま。確認録画を見せる
- B1（独立レビューで見つかった不具合）: 相手が更新している間に、下書きを開始時の値へ戻したら、送信せずに相手の値を表示する

## 1本目（#9）の結果
- 範囲は Inspector、糸ラベル、右パネル。stream には変更なし。コード差分は 396 行
- 書き手は Codex、レビューは Claude Code（3回）。最終判定は OK で、ブロッキング指摘は 0: https://github.com/zou3tokirin3/argboard/pull/9#issuecomment-6702666782
- PR 本文と各コメント: https://github.com/zou3tokirin3/argboard/pull/9
- 検査: check、unit 145/145、build、Playwright smoke 2/2 がすべて pass。ローカルの Wrangler DO と2つのブラウザ context での確認も 9 件 pass（B1 を含む）
- 確認録画（中身はテスト用のデータだけ）:
  - [media/T098-phase1-verification-side-by-side.mp4](media/T098-phase1-verification-side-by-side.mp4)（45秒、2画面）
  - [media/T098-phase1-b1-same-field.mp4](media/T098-phase1-b1-same-field.mp4)（23秒、同じ欄での B1）
  - [media/T098-phase1-peer-2-1280.png](media/T098-phase1-peer-2-1280.png)
  - [media/T098-phase1-result-390.png](media/T098-phase1-result-390.png)
- 未確認:
  - 実際の OS の日本語入力。テストは合成した変換イベントだけ
  - 隆さんの手での確認
  - Inspector での Esc による取り消し（承認された範囲に入っていない）

## #9 マージ後の本番確認（coordinator 記録、16:35 JST）
- 本番確認の結果ファイルで **8/8 success** を確認。ここで本番へ再接続はしていない。
- Pages の release 0.84 と共有ボタン非表示、新規2 context のプロジェクト分離、contemplate / rail の Inspector 表示、タイトルの idle / Enter、糸ラベルの idle / Enter、本番 room の初期 replay、タイトルの同じ欄での B1、糸ラベルの同じ欄での B1 が成功。
- B1 は元値 X → 自分の下書き Y → 相手の確定 Z → X に戻して blur の順。両表示・保存値は Z、自分の update 呼出しは0。実 OS IME の確認とは別。

## 2本目（phase2 / stream）のレビュー用引き継ぎ
- 実装範囲: stream タイトルの 400ms debounce 撤去、blur / Enter の変更時保存、composition / key229 保護、切替保存、Esc 破棄、同じ欄の B1。Inspector・T103 の実装は変更しない。
- writer 検査: check（Biome / TypeScript）・unit（145/145成功、失敗0）・build は成功。sandbox 内の smoke 2本と evidence は Chrome の `setsockopt EPERM` で起動前に停止。初回の外側実行は composition ガード assertion に失敗したが、リスナーの大文字小文字不一致を修正し、**修正後の外側 evidence は8シナリオすべて PASS、blocker なし**。初回失敗の結果は履歴であり、以下の成功結果が最新。
- coordinator が実ローカル Wrangler DO + WebSocket の独立2 context で実行し、同じ room の初期 replay・ack・実 WebSocket 接続を確認。成功した8シナリオ: idle 非保存と title のみの Enter 保存、合成 composition / isComposing / key229 各ガード、Esc 後の blur・idle・明示 flush・切替でも更新呼出し0、未確定のままカード切替して元カードを保存、変更時の blur 保存、focused flushSave 後の開始値更新と compositionend 欠落後の復帰、同じタイトル欄の B1 X/Y/Z、blur 後の相手値追従。本文・タグ・サイズの維持も検査。
- タイトルは wide 表示で編集し、contemplate / rail は読み取り表示。合成 composition は **SYNTHETIC / NOT OS IME**。実 OS IME の確認とは区別する。
- **実際に生成され、サニタイズ済み成果物をこの資料へコピー済み**。生ログ・端末内のパス・非公開情報は含めない。動画の人間による確認は別途必要。
  - [確認録画（約33秒、左右2画面）](media/T098-phase2-verification.mp4)
  - [1280px 画像](media/T098-phase2-1280.png)
  - [390px 画像](media/T098-phase2-390.png)
- 独立 Claude Code レビュー1回目は NOT OK（証跡の blocking 1件）。修正後の成功証跡を用意したが、**再レビューの最終判定は未取得**。レビューリンクは作成予定の phase2 PR のコメントに記録し、この資料にも追記する。録画の人間確認、実 OS IME、**phase2 の個別マージ承認は未完**。T098 は review / gate: human、release 0.84 のまま。done / bump は行わない。

## 次にやること
1. T098 の2本目（stream 側、Esc、競合）: 実装と外側8シナリオの成功証跡は用意済み。作成予定PRで独立AIの再レビュー結果を記録し、録画を人間が確認する。マージの前に隆さんの別承認を取る。ローカルの snapshot は参考のみ（公開しない）
2. T103: 下の docs-only PR でカードを main に入れる。実装は承認されてから
3. この資料は docs-only PR で `docs/handoffs/2026-11-07/` に入れた（作業用の生メモ、snapshot の差分、ログは入れていない）

## T103（文言を辞書に切り出し、多言語化する）
- カード: [../../../.dev-os/kanban/cards/T103-ui-wording-i18n-catalog.md](../../../.dev-os/kanban/cards/T103-ui-wording-i18n-catalog.md)（backlog、gate: human）。ID はコミット直前（16:31 JST）にリモートとローカルの両方で空きを確認した
- 設計の確定方針: [design.md](design.md)。日本語が既定で、型付き辞書と `t()` を使い、ライブラリは追加しない。保存データ・ID・DB・event/room・export は変えない。言語は `?lang=ja|en` だけで選ぶ。日本語の切り出しを先にして、英語は後

## 環境の再現（公開されている手順だけ）
- Node v24.22.1、pnpm 12.18.0（corepack）。リポジトリで `pnpm install --frozen-lockfile`
- Codex: `npm i -g @openai/codex@0.164.0 --prefix ~/.local` → `~/.local/bin/codex`。ログインは人が行う（ここでは行っていない）
- レビュー役の Claude Code: `~/.local/bin/cc`（認証済みのものがすでにある）
- Playwright: 公式のブラウザと ffmpeg のインストール手順を使う
- gh は `gh pr checks` が 403 になるので、`gh run list --branch main` を使う

## 検証の区別
- 本番で確かめたこと: #9 のマージ、両デプロイの success、両公開版の `"0.84"`（16:27 JST）
- ローカルで確かめたこと: phase1 の unit / smoke / 同期と録画。phase2 は check / unit145 / build、外側の実 Wrangler DO・2ブラウザの8シナリオと約33秒の録画生成が成功。phase2 の smoke は sandbox で起動前停止した記録のままで、外側 evidence の成功と混同しない
- #9 の本番2ブラウザ確認: 上記8項目成功。phase2 の本番確認と、実際の OS 日本語入力: 未確認
