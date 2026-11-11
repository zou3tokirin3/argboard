---
id: T103
title: 画面の文言を型付き辞書に切り出し、日本語のまま差し替え可能にしてから英語を足す
status: review
owner: Codex
gate: human
branch: "task/T103-i18n-slice5"
template_ver: generic-0.2
created: 2026-11-07
updated: 2026-11-09
---

## 目的

呼び名の変更や外国語対応を、人が辞書や設定を触らずに、AIへの自然文の依頼だけで安全にできるようにする。

## 出典・判断

- 2026-11-07 14:06 JST 隆さん原文「argのやつ、各種ワード気に入らないとか、外国語対応で簡単に差し替え可能にできる？」→「相談して決めて、人間いじらずAIがやる」
- 設計決定: 隆さんの委任に基づき開発マネージャー（2026-11-07 14:07 JST、下記方針1〜7を採用）
- 2026-11-07 14:08 JST 隆さん原文「別カードにしておいて」。承認はカード作成のみ。実装・PR・マージは未承認
- T098 とは独立。T098 の完了後に、最新 main から小さい PR で着手する

## 確定方針

1. 依存は追加しない。`src/i18n/ja.ts`（既定・正本、`as const`）＋`en.ts`（`satisfies Messages`。キーが欠けたら tsc で失敗）＋`t(key, params)`
2. キーは意味ベースで固定する（例 `inspector.title.label`）。文は丸ごと持ち、語の継ぎ接ぎはしない。差し込みは型付き `{name}` でテキストとして扱い、生HTMLにしない。日付・数は `Intl`
3. 訳さないもの: ユーザー入力（カード本文・タイトル・タグ・糸ラベル）、ID・enum の値、IndexedDB の形、event/room op、エクスポート形式。生成される履歴文は棚卸すが、保存済みの履歴は書き換えない
4. 既定は ja。実行時にキーが欠けたら ja で表示し、開発時だけ console.warn を出す
5. 言語は URL `?lang=ja|en` のみで選ぶ。未指定・未対応の値は ja。人手の編集UI・設定の永続化・ブラウザ言語の自動判定・実行時翻訳は作らない
6. AI 向け: `docs/i18n.md`（用語集の ja↔en 対訳と禁止訳、ルール、チェックリスト）を AGENTS.md から参照する。呼び名変更は「用語集→ja.ts→en.ts→テスト」の順で行う
7. 検証: tsc、node:test（全ロケールのキーと差し込み変数が一致）、UI 日本語の直書き検出（許可: ja.ts・テスト fixture・コメント）、既存の smoke

## 段階

- ① 基盤・用語集・AI 手順・検査と、画面単位の日本語抽出（表示は変えない。約400行を超えるなら画面ごとに PR を分ける）
- ② 英語ロケールと `?lang=`（見た目が変わるので隆さんの確認が要る）

## 受け入れ条件

- [ ] ①後、1280/390 のスクショで抽出前と差分がない
- [ ] 対象（ラベル・ボタン・placeholder・aria-label/title・エラー/トースト・prompt/confirm）が `t()` 経由になり、直書き検出テストが通る
- [ ] 全ロケールでキーと差し込み変数が一致することをテストで確認でき、欠けたキーは ja にフォールバックする
- [ ] 保存データ・IndexedDB・event/room op・エクスポートの形が変わっていない（既存テストと smoke が通る）
- [x] `docs/i18n.md` と AGENTS.md の参照がある
- [ ] ②後、`?lang=en` で英語、未指定・不正値で日本語になる（1280/390 のスクショ）
- [ ] flow しきい値（本体行 +200 / 操作 +3 / 概念 +2 / gzip +8KB / Won't）を意識し、超過見込みなら評価パケットへの人間GOが作業ログにある

## 確認観点（gate: human のとき）

表示: タブ・左上が **`ARGBoard · <release>+<id>`**（review 中）または **`ARGBoard · <release>`**（done 後）であること。

- [ ] 普段どおり操作して、文言と見た目が変わっていない（①）
- [ ] URL に `?lang=en` を付けると英語になり、外すと日本語に戻る（②）

## 未確認

- 現在の直書き文言の数と場所（リポジトリ未調査）、各 PR の行数

## 作業ログ（追記のみ）

- 2026-11-07 14:10 JST カード起票（argboard開発）。実装は未承認

- 2026-11-09 21:57 JST 隆さん承認「argboard T103を実装まで進めて。マージは別確認」。実装からPRまで承認、マージは未承認。11/07時点の実装未承認をこの範囲で更新。
- 2026-11-09 Codex writer: phase1最初のスライスとして基盤・用語集・AI手順・型/キー/変数/直書き検査＋画像拡大画面6文言だけを抽出。全UIは約400コード行超のため停止し、後続画面別PR計画を docs/i18n.md に記載。phase1全体・phase2は未完了。status reviewはこのスライスのレビュー用（PR作成はcoordinatorへ引き継ぎ）。
- 2026-11-09 開始HEAD df131d1（T098完了、APP_RELEASE 0.85）。ローカルmain参照は古いが、提供された現ブランチから作業。既存origin/main参照もdf131d1と一致。ネットワーク禁止のためリモート最新mainの照合は未実施。T098/T101・データ形・releaseは変更しない。
- 2026-11-09 抽出前スクショをPlaywrightで試行したが、Chromiumが sandbox_host_linux.cc の shutdown: Operation not permitted で起動不可。1280/390前後比較は未検証、coordinator環境で再実行が必要。手順は /workspace/argboard-t103/screenshots.mjs。

- 2026-11-09 検証: check・全31 unit testファイル・build成功。追加i18n 5ケース成功。元HEADと抽出後の仮想DOM（要素/文字/属性、コールバックは正規化）11ケース一致。ブラウザ画面比較の代替とはしない。smokeは指示どおりcoordinator担当。writer報告・検証ログ・ローカルPR原稿は /workspace/argboard-t103/。

- 2026-11-09 調整担当が画像拡大画面の文言抽出前後のスクリーンショットを1280/390の両幅で比較し、ピクセル単位で完全一致を確認。証跡は docs/i18n/media/ 配下。ステータスは review を維持。

- 2026-11-09 22:37 JST 隆さんが#12のマージを承認（be9c285へ反映済み）。残画面・英語/URL言語選択は後続PRで継続可。今回のslice2のマージは別承認が必要。
- 2026-11-09 Codex writer / slice2: 指定ブランチ task/T103-i18n-next、base be9c285から画像添付欄 ui/card-image-field.tsx のみ抽出。ja.tsへ11キー追加、拡大の既存2キーを再利用、直書き検出対象を同ファイルへ拡張。captureのpasteExploreImage・画像下書きとstateの入力検証を調査し、400コード行以内の独立面を守るため後続へ分割。docs/i18n.mdに対象・エラー境界・後続計画を追記。status reviewを維持、T103全体は未完了、APP_RELEASE 0.85維持。英語・en.ts・URL言語選択は変更しない。
- 2026-11-09 slice2のブラウザ起動を試行したが、Chromiumが sandbox_host_linux.cc の shutdown: Operation not permitted で停止。1280/390の抽出前後スクショは未検証。coordinator向け再現スクリプトとログを /workspace/argboard-t103-slice2/ に残す。ネットワーク・commit/push/post/merge/login/vault操作は行わない。

- 2026-11-09 slice2検証: npm run check（Biome・tsc 2構成）、npm test（31ファイル成功・失敗0）、npm run build、git diff --check成功。抽出前be9c285と抽出後の仮想DOM96ケース（compact/inline/既定、狭幅ヒント、disabled、画像なし/読込中/あり、拡大有無）とエラーフォールバック・Error.message通過・busy解除が一致。画面比較の代替とはしない。コード差分は46行（追加30/削除16、docs・カードを除く）で約400行以内。スクショ再現スクリプトの構文検査のみ成功、実画面比較と既存smokeはcoordinatorへ引き継ぎ。報告: /workspace/argboard-t103-slice2/writer.md。

- 2026-11-09 レビュー指摘対応: #12は22:37 JSTにマージ済み（be9c285）。今回のslice2は `ui/card-image-field.tsx` の日本語文言抽出。coordinatorが1280/390の抽出前後スクショ比較と既存smokeを完了し、上記の引き継ぎ時点の未検証を更新。PNGにはサブピクセル描画・AAによる1〜2階調・小さなbboxの描画ノイズが残る場合があるが、DOM96ケースと表示文字列は一致。前後PNG・差分マスクは `docs/i18n/media/T103-slice2-*`、比較の説明と各証跡へのリンクは [docs/i18n.md](../../../docs/i18n.md#slice2の画面比較証跡)。statusはreviewのまま、T103全体はdoneにしない。APP_RELEASEは0.85を維持。英語・URL言語選択は今回の対象外。今回のslice2のマージは別承認。

- 2026-11-09 Codex writer / slice3: base c4153cb、task/T103-i18n-slice3。CaptureImageSlot（ファイル選択・貼り付け）だけを ui/capture-image-slot.tsx に分離し、ja.tsへ4キー追加・既存エラーキー1つを2箇所で再利用。作中時間補助関数は原文のまま同ファイルへ移動。直書き検査対象は新ファイル全体へ拡張。約400コード行以内の独立面で停止し、画像準備・参照と上流エラーは後続。status review、T103全体は未完了、APP_RELEASE 0.85維持。英語・en.ts・URL言語選択は追加しない。検証結果と同一描画条件のスクショ再現スクリプトは /workspace/argboard-t103-slice3/writer.md と screenshots.mjs に記録。ネットワーク・commit/push/post/merge/login/vault操作は行わない。

- 2026-11-09 slice3検証: npm run check・npm test（31ファイル成功/失敗0）・npm run build・git diff --check成功。辞書解決後の移動2関数（JSX・全イベント/エラー/busy処理を含む）は抽出前とesbuild出力一致。コード差分285行（追加153/削除132、新規ファイル141行を含む、docs/カード除外）。同じesbuild処理で両版をビルドする screenshots.mjs は構文・両版ビルドまで成功。Chromiumが sandbox_host_linux.cc の shutdown: Operation not permitted で起動不可のため、1280/390のPNG完全一致は未検証。固定時計・DPR1・fonts.ready・networkidle・指定CSS・animations disabledを設定し、画像なし/ファイル選択後の4組すべてのSHA-256一致を必須にする。実画面比較と既存smokeはcoordinator確認待ち。描画ノイズの許容で完全一致条件を緩和しない。

- 2026-11-09 slice3 coordinator検証完了: `/workspace/argboard-t103-slice3/screenshots/` の `before/after-{empty,selected}-{1280,390}.png` 全4組でSHA-256が一致し、抽出前後のPNG完全一致を確認。上記の画面比較・既存smokeの確認待ちを更新。npm run check・unit 150件（失敗0）・npm run build・既存smoke 2件が成功（同ディレクトリ直下の check.log / unit.log / build.log / smoke.log）。今回のログ更新でもPNGのSHA-256一致と保存済み検証ログを確認。status review・APP_RELEASE 0.85を維持し、T103全体は未完了、マージは別承認。今回の変更はカードの作業ログ追記のみで、製品コード変更・commit・ネットワーク・login・vault操作なし。

- 2026-11-09 Codex writer / slice4: base 76803a0、task/T103-i18n-slice4。Captureの残り全体（ui/capture.tsx）1面だけをt()抽出し、ja.tsへ47キー追加、画像添付エラーは既存キーを再利用。同ファイル全体を直書き検査に追加。通常入力・掘り中・タグ・画像準備/参照・ヒントが対象。既存JSXと空白・ユーザー入力・Error.message・操作を維持。共有コントロール、state/image-compress上流エラー、Stream/Board等は後続。status review、T103全体は未完了、APP_RELEASE 0.85維持。英語・URL言語選択は追加しない。
- 2026-11-09 slice4 writer検証: check・unit（31ファイル成功/失敗0）・build・diff --check成功。辞書解決後のCaptureモジュール全体が抽出前とesbuild出力一致（JSX/空白・イベント/エラー処理含む）。スクショスクリプトは同じesbuildで両版ビルド成功、Chromiumは sandbox_host_linux.cc の shutdown: Operation not permitted で起動不可。固定時計・font-smoothing none・animation/transition無効、1280/390×6状態すべてのPNGのSHA-256完全一致を必須とし、描画ノイズは許容しない。PNG完全一致と既存smokeはcoordinator確認待ち。手順・残計画・ログは /workspace/argboard-t103-slice4/writer.md と screenshots.mjs。ネットワーク・commit/push/post/merge/login/vault操作なし。

- 2026-11-09 slice5 coordinator検証完了: Stream抽出前後の1280/390×18状態、全36組（36/36）のPNGでSHA-256完全一致を確認。前後PNGは `docs/i18n/media/T103-slice5-{before,after}-*.png`、成功ログは `/workspace/argboard-t103-slice5/shot.log`。下記slice5 writer記録のPNG比較・smoke確認待ちを更新。npm run check・unit 150件（失敗0）・npm run build・既存smoke 2件がすべて成功（同ディレクトリの check.log / unit.log / build.log / smoke.log）。今回の記録更新でも全36組のSHA-256一致と保存済み検証ログを確認。status review・APP_RELEASE 0.85を維持し、T103全体は未完了、マージは別承認。今回の変更は docs/i18n.md と本カードの作業ログのみ。製品コード変更・commit・ネットワーク・login・vault操作なし。

- 2026-11-09 Codex writer / slice6: base 9ec1cd608747abd641414c177add9ba2b2d73aff、task/T103-i18n-slice6。Inspector全体とcard-role-toggle / thought-outcome-field / thought-outcome（ラベル関数のみ）/ digging-controlsをt()抽出。68キー追加、同文の既存キー再利用、5ファイル全体を直書き検査へ追加。コード差分283行（追加194/削除89、docs/カード/外部引継ぎスクリプト除外）。タグ整理promptは文全体・型付き差し込み、ユーザー入力/保存形式/イベント/成否正規化は維持。check・unit全31ファイル（失敗0）・build・diff --check成功。スクショスクリプトは同一esbuildで両版ビルド、構文検査成功。固定時計・DPR1・font-smoothing none・animations無効、1280/390×7状態14組のPNG SHA-256完全一致を必須にした。Chromiumが shutdown: Operation not permitted で起動不可、PNG比較と既存smokeはcoordinator担当。docsに証跡記入欄、/workspace/argboard-t103-slice6/writer.mdに残計画を記載。status review、T103全体未完了、APP_RELEASE 0.85維持。カードは作業ログ追記のみ。英語/en.ts/?lang追加なし。ネットワーク・commit/push/post/merge/login/vault操作なし。

- 2026-11-09 Codex writer / slice8: base 6fb393dc3722c574e60685c566b02e0a3d53c301、task/T103-i18n-slice8。ui/board.tsx と ui/lane-view.tsx の日本語UI全体をt()抽出。27キー追加、同文の既存キー（役割・視点・凡例・閉じる・いまに戻る）を再利用、両ファイルを厳密直書き検査へ追加。コード差分136行（追加87/削除49、docs/カード/外部スクリプト除外）。check・unit全31ファイル（失敗0）・build・diff --check成功。同一esbuild・固定時計・DPR1・font-smoothing none・animations無効、1280/390×10状態のPNG SHA-256完全一致とtitle/aria一致を要求するscreenshots.mjsを更新。凡例・視点/作中操作・開いたLane・リプレイを対象とし、構文検査・両版ビルド成功。Chromiumが shutdown: Operation not permitted で起動不可、PNG比較は未検証、既存smokeは未実施でcoordinator担当。docsの証跡記入欄と /workspace/argboard-t103-slice8/writer.md に手順/残計画を記載。status review・T103全体未完了・APP_RELEASE 0.85維持。Projectデモ/生成履歴・作中時間解析・state/syncエラー・英語/en.ts/?langは変更しない。ネットワーク・commit/push/post/merge/login/vault操作なし。

- 2026-11-10 Codex writer / slice9: base a778407b1ae4e9fa9cfc64468ba824be0f59d295、task/T103-i18n-slice9。stream-sticky-trailのaria、mediaのzipエラー、image-compressの圧縮エラーを5キーでt()抽出。上記3ファイルと日本語のないmedia-thumb / icon-tip / thought-outcome-iconの計6ファイルを厳密検査へ追加。原文5キーの単体検査を追加、node strip-types経由のmediaテストも成功。check・unit全31ファイル（失敗0）・build・diff --check成功。同一esbuild・固定時計・DPR1・font-smoothing none・animations無効のscreenshots.mjsを作成し、1280/390×4状態のPNG SHA-256完全一致とtrail aria / UI import alert一致を要求。構文検査・両版ビルド成功、Chromiumは shutdown: Operation not permitted で起動不可。PNG/JSON比較・既存smokeはcoordinator確認待ち。docsに証跡記入欄・残計画、/workspace/argboard-t103-slice9/writer.mdに結果を記載。status review・APP_RELEASE 0.85維持、T103全体未完了。state/sync、projectデモ/履歴、作中時間解析、英語/en.ts/?langは変更なし。ネットワーク・commit/push/post/merge/login/vault操作なし。

- 2026-11-10 coordinator argboard開発 / slice9: 1280/390×4状態のPNG SHA-256 8/8一致（1280は親trail表示、390は内側スクロールなしでtrail非表示を両版で確認）、trail aria・import alert 3種のJSON前後一致。check・unit 151件（失敗0）・build・既存smoke 2件成功。証跡PNGは docs/i18n/media/T103-slice9-*。status review維持、マージは隆さんの別確認待ち。

## 差し戻し履歴（追記のみ）

- 2026-11-09 Codex writer / slice5: base e86e0b8、task/T103-i18n-slice5。ui/stream.tsx全体の日本語UIを58キーで抽出し、ファイル全体を直書き検査へ追加。コード差分264行（追加183/削除81、docs/カード除外）。check・unit test全31ファイル・build成功。スクショ比較スクリプトは同じesbuild、固定時計、animations無効、font-smoothing none、1280/390、18状態36組のSHA-256完全一致を要求。Chromiumが shutdown: Operation not permitted で起動不可、PNG比較とsmokeはcoordinator検証待ち。status review・APP_RELEASE 0.85維持、T103全体は未完了。英語/?langなし。残計画と証跡は /workspace/argboard-t103-slice5/writer.md。ネットワーク・commit/push/post/merge/login/vault操作なし。
- 2026-11-09 slice6 coordinator検証完了: inspector要素の1280/390×6状態、全12組PNGでSHA-256完全一致。証跡 docs/i18n/media/T103-slice6-*。check・unit150・build・smoke2成功。status review・APP_RELEASE 0.85維持。

- 2026-11-09 Codex writer / slice7: base fd01db33d7e25e0a2c100c70a2ca3ae6b6f2176b、task/T103-i18n-slice7。ui/main.tsxの日本語UI全体をt()へ抽出。38キー追加、stream.label / capture.close.labelを再利用し、Main全体を厳密直書き検査へ追加。インストール案内・保存状態・プロジェクトメニュー・共有prompt/状態・JSON入出力・発見ログchrome・A/B/C/Dラベル/ariaが対象。保存状態/件数/共有状態は文全体と型付き差し込みで保持。コード差分148行（追加96/削除52、docs/カード/外部スクリプト除外）。check・unit全31ファイル（失敗0）・build・diff --check成功、保存状態36ケースの正規化VDOM一致（コールバック除外）。同一esbuild・固定時計・DPR1・font-smoothing none・animations無効、1280/390×19状態のPNG SHA-256完全一致とtitle/aria一致を要求するscreenshots.mjsを更新。両版ビルド・構文検査成功、Chromiumは shutdown: Operation not permitted で起動不可。PNG比較/既存smokeはcoordinator担当。docsの証跡記入欄と /workspace/argboard-t103-slice7/writer.md に手順/残計画を記載。status review・T103全体未完了・APP_RELEASE 0.85維持。Board/Lane/Project履歴/デモ・作中時間解析・英語/en.ts/?langは変更しない。ネットワーク・commit/push/post/merge/login/vault操作なし。
- 2026-11-09 slice7 coordinator検証完了: Main chrome 1280/390×19状態、全38組PNGでSHA-256完全一致。証跡 docs/i18n/media/T103-slice7-*。status review・APP_RELEASE 0.85維持。
- 2026-11-09 slice8 coordinator: board+lane抽出済み。12組中11一致、focus-1280のみAA差分（HTML一致）。条件(d)未充足のためセルフマージせず確認待ち。
- 2026-11-11 Codex writer / slice10: base 044a49e2cea8f3145ae9aa1564afdc804449153d、task/T103-i18n-slice10。sync-clientの同期状態4キー、stateの画像形式エラー/import非Errorフォールバック2キーをt()抽出し、stateの同期状態初期値/リセットも共通キーを再利用。sync-client全体を厳密検査へ追加し、stateは保存データ7箇所（共有ボード1・新しいケース2・無題2・取り込み2、検出器では10断片）の明示リストで検査。原文6キーの単体検査を追加。コード差分66行（追加54/削除12、docs/カード/外部スクリプト除外）。check・unit全31ファイル（失敗0、既存sync-client/state関連を含む）・build・diff --check成功。slice9からオフライン画面比較スクリプトを作成し、偽WebSocketで共有状態4種、Inspectorでtext/plain選択後の画像エラーalertを再現する。構文検査・両版ビルド成功、Chromiumは shutdown: Operation not permitted で起動不可。1280/390×5状態のPNG SHA-256完全一致とstatus/dialog JSON一致は未検証、既存smokeはcoordinator担当。docsに証跡記入欄・残計画、/workspace/argboard-t103-slice10/writer.mdに結果を記載。status review・T103全体未完了・APP_RELEASE 0.85維持。保存データ・同期契約・project/story-when/release・英語/en.ts/?lang変更なし。ネットワーク・commit/push/post/merge/login/vault操作なし。
- 2026-11-11 coordinator argboard開発 / slice10: 1280/390×5状態（共有状態4種＋画像形式alert）のPNG SHA-256 10/10一致、status/alert JSON前後一致。check・unit 153件（失敗0）・build・既存smoke 2件成功。status review・APP_RELEASE 0.85維持。
