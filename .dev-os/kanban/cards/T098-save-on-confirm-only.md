---
id: T098
title: Inspector・stream の保存を「確定時のみ・変更項目だけ」に統一する
status: review
owner: Codex
gate: human
branch: "task/T098-inspector-confirm"
template_ver: generic-0.2
created: 2026-10-26
updated: 2026-11-07
---

## 目的

T082設計検討の結論①を実装する（T097の後に行う）。
各入力欄が「確定したとき（blur/Enter）に変えた項目だけを送る」形に揃える。

## 背景

T097で `updateCard` が部分更新対応になった後、呼び出し側の保存タイミングを整理する。
設計相談で指摘された毎キー即保存の問題（IME・Escキャンセル・書き込みコスト）を解消する。

## やること

### Inspector（`inspector.tsx`）

- **旧**: カード切り替え時に `dirtyFieldsRef` の全項目を一括 flush
- **新**: 各フィールドが独立して確定（blur/Enter）したとき、そのフィールドだけ送る
- `dirtyFieldsRef` は残す（フォーカス中の欄を外部更新で書き換えないための保護に使う）
- IME 変換中（`isComposing`）は送らない

### stream のタイトル編集（`stream.tsx`）

- 「確定」: blur / Enter → `updateCard(id, { title: draft })`
- 「Escキャンセル」: draft を破棄、`updateCard` を呼ばない（現在の仕様を維持）
- 400ms debounce は撤去。入力停止では保存しない（2026-11-07 人間承認）

## 受け入れ条件（2026-11-07 承認の6項目）

- [ ] 入力停止では保存せず、blur / Enter で変更した欄だけを保存する（400ms debounce 撤去）
- [ ] 別カードへの切替時は、未確定欄を元のカードへ強制保存する
- [ ] 共同編集は focused dirty 欄を保護し、blur 後に届く相手の値を反映する
- [ ] stream の Esc は下書きを破棄し、blur・待機後も updateCard 呼出し0（保留 debounce なし）
- [ ] title / url / body / storyWhen / storyUntil / 糸ラベルへ適用。タグ・サイズは即時保存を維持
- [ ] IME変換中 Enter は確定しない。最終編集で check / test / build / smoke を確認し、日本語入力・Esc・共同編集の録画を人間が確認してから別途マージ承認

自動 composition イベントは実OSの日本語IME確認と区別する。T098はreviewのまま、phase1/phase2とも承認待ち。旧証跡はsplit前の履歴で、phase1のB1成功証跡として扱わない。

## このカードでやらない

- `state.ts` の分割（→ T099）
- Esc 統一（→ T100）

## 依存

- T097 完了後に着手する

## 作業ログ（追記のみ）

- 2026-10-26 planner: T082設計相談の結論を受けて起票

- 2026-11-07 Codex: 13:14 JST 人間承認「T098は6項目ともおすすめで進めて。マージは別に確認して」を反映。ユーザー指定により現ブランチで実装し review に配置、取得コミットは作成しない。
- 2026-11-07 Codex: Inspectorの欄単位確定とdirty解除、選択ごとに保持するrefの切替flush、糸ラベル確定、stream debounce撤去とEscのblur/unmount保存抑止を実装。IME EnterはisComposing・composition状態・keyCode229で保護。本文はShift+Enterで改行、Enterで確定。T099/T100・タグ・サイズ・release 0.84は変更なし。
- 2026-11-07 Codex: ブラウザー回帰テストを1本追加（入力待機・項目分離・日付/URL・composition模擬・切替・stream Esc/Enter・糸ラベル）。scratch evidence.mjs に実ローカルWrangler二context共同編集・1280/390画像・webm・結果JSON生成を用意。
- 2026-11-07 Codex: 既存corepack起動で意図せず依存取得が試行されDNSエラーを観測。以後はnodeで既存ツールを直接実行。依存不在時のtestは26成功/4起動失敗、依存が再び利用可能となった再実行は30成功/0失敗。依存物の再配置経緯は未確認、追加インストール指示・認証操作なし。
- 2026-11-07 Codex: 型検査成功、ビルド成功。ブラウザー標準実行はPlaywright Chromium不在、既存Chromeでの代替実行はsetsockopt EPERMで2本とも開始前失敗。localhost listenもEPERM、Wranglerはログ先EROFSとuv_interface_addressesで起動不可。evidence result.json はblocked、画像0・動画0、実OS IME・Esc・共同編集の録画確認は未実施。マージ・公開・コミットなし。

- 2026-11-07 Codex（coordinator外側実行後の修正）: smoke-outside.log は既存smoke成功・T098のみ糸ラベル待機timeout。既定右パネルBがカード選択のみを表示条件とし、糸選択時のclearCardSelectionでInspectorが消えることを特定。糸選択も表示条件へ含め、「＋新規」は糸選択も解除するよう修正。テスト/evidenceのアサーション変更なし。最終コード/テスト差分399行、check・unit30成功/0失敗・build成功。外側でのブラウザー再実行待ち（既存の部分証跡は画像3/動画2、共同編集未実行、実OS IME未確認）。review/human gate・0.84維持、コミット/ネットワークなし。

- 2026-11-07 Codex（review-1照合）: 最新evidenceは9項目成功・画像6/動画2・実Wrangler共同編集成功を確認し、糸ラベルB2は既修正の成功証跡へ更新。B3は今回ユーザーがbodyを含むEnter確定を明示承認したため現状維持。B1の「元に戻す＋相手更新」競合には編集開始値保持と回帰テストが必要で、現399行から上限超過が見込まれるためコード変更前に停止。T098内2レビューパッチの最小分割案をscratch writer-review-reply.mdへ記録。実OS IMEと最終smoke全体再実行は未完、人間ゲート未通過。

- 2026-11-07 Codex（承認済みsplit phase1）: 14:03 JST「T098は提案どおり2本のPRに分けて、不具合を直して進めて。どちらもマージは別確認」を反映。task/T098-snapshot の93f9654に元の全実装・アサーションを保存済みであることを確認。phase1はInspector/糸ラベル/右パネルと対応テストのみ。stream.tsxはorigin/mainへ戻し、streamテストはphase2へ保留（snapshotに保持）。
- 2026-11-07 Codex（phase1 B1）: 欄・糸ラベルの編集開始値を保持し、開始値へ戻した場合は書かず最新の相手値を再表示。変更が残る場合だけ自分の欄を保存する。非dirty欄は表示とrefを相手値へ同期。カード切替強制保存・IME Enter保護・本文Enter確定/Shift+Enter改行・タグ/サイズ即時を維持。InspectorのEscキャンセル要件はなく、追加しない。
- 2026-11-07 Codex（phase1検証）: check成功・unit30成功/0失敗・build成功。phase1/evidence.mjsは実Wrangler二contextでカード/糸ラベル両方のB1、変更欄保存、非dirty欄追従、カード切替をassertし、約30–60秒の説明付き同時録画2本と1280/390画像を生成する構成。sandbox実行はChrome setsockopt EPERMで起動前blocked（画像0/動画0/ブラウザーassertion未実行）。標準smokeは既定Chromium不在で起動前2失敗、既存Chrome代替もEPERMで起動前2失敗。コード/テスト396行（文書別）。coordinator外側実行と左右合成・視聴、2回目レビュー、実OS IME、人間マージ承認は未完。phase1/phase2 pending・review/human・release 0.84を維持。

## 差し戻し履歴（追記のみ）
