# argboard 引き継ぎ 2026-11-07（T098 / T103）

作業用のローカル領域がなくても続けられるように書いた引き継ぎ。認証情報・セッション・生ログは含まない。
時刻はすべて JST。Obsidian Sync の状態は未確認なので、同期済みとは書いていない。

## 状態（2026-11-07 16:27 JST に GitHub で確認）
- PR #9（T098 の1本目）https://github.com/zou3tokirin3/argboard/pull/9 : 2026-11-07 16:26:57 JST にマージ済み。merge commit `e098106`、head `9fda3a7`
- main = `e098106`。Deploy to Cloudflare Workers と Deploy GitHub Pages はどちらも success
- 公開版はどちらも `"0.84"`: https://argboard.zou3tokirin3.workers.dev/ と https://zou3tokirin3.github.io/argboard/
- T098 のカードは、PR ブランチ上で `status: review`。main 上の状態はこの bundle を作った時点では見ていない
- 2本目（stream 側）: 実装・別AIレビュー・確認録画は 13:14 と 14:03 の承認の範囲内で、16:26 に開発マネージャーから続行の指示も出ている。**マージだけは隆さんの別承認が必要**。作業の途中経過はローカルの snapshot（`93f9654`）にしかなく、リモートにはない

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

## 次にやること
1. T098 の2本目（stream 側、Esc、競合）: 承認済みなので、最新の main から上の仕様と B1 の条件に沿って実装し、別の AI がレビューして、録画を付ける。マージの前に隆さんの別承認を取る。ローカルの snapshot は参考にとどめる（公開しない）
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
- ローカルでだけ確かめたこと: unit / smoke / 2ブラウザの同期（ローカル Wrangler DO）と録画
- 本番での2ブラウザ確認と、実際の日本語入力: 未確認
