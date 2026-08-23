---
id: T062
title: フォーカスと見出しの床を揃える
status: doing
owner: impl
gate: human
branch: "task/T062"
template_ver: generic-0.2
created: 2026-08-23
updated: 2026-08-23
---

## 目的

キーボードと支援技術で辿れる床が、キャプチャ入力以外で薄い。
モード切替は tab 見た目なのに矢印が効かない。検索のフォーカスリングが無い。
貼付スロットはマウス／ペースト専用。発見ログは 0 件でも理由を出さない。

出典: 2026-08-23 UI評価（web-design-guidelines + 実機スクショ）
対象の目安: `ui/main.tsx`（tablist・見出し） / `ui/styles.css`（検索フォーカス） /
`ui/capture.tsx`（貼付スロット） / `ui/stream.tsx`（empty）

## 受け入れ条件

- [x] ページに `h1` があり、本文へ飛ばす skip link がある
- [x] モード切替（`role="tablist"`）が左右矢印で動く
- [x] 検索入力のフォーカスが、キャプチャ入力と同じ 3px ring 相当で見える
- [x] スクショ貼付スロットが Enter / Space でファイル選択を開ける（`role="group"` のままにしない）
- [x] 発見ログが 0 件、またはフィルタで 0 件のとき、空の理由が1行出る
- [x] 既存のマウス操作・キャプチャ・フィルタの意味は変えない
- [x] flow しきい値（本体行 +200 / 操作 +3 / 概念 +2 / gzip +8KB / Won't）を意識し、超過見込みなら評価パケットへの人間GOが作業ログにある

## 確認観点（gate: human のとき）

表示: タブ・左上が **`ARGBoard · <release>+<id>`**（review 中）または **`ARGBoard · <release>`**（done 後）であること。
`<release>` は `ui/release.ts` の `APP_RELEASE`。review 中は `APP_PREVIEW` に本カード id を入れる。

- [ ] Tab で skip link → 入力へ辿れる
- [ ] モードタブにフォーカスして矢印で探索／考察が切り替わる
- [ ] 検索欄フォーカス時にリングが見える
- [ ] 貼付スロットをキーボードで開け、フィルタ全オン相当で空メッセージが出る

## このカードでやらない

- 削除の確認ダイアログ／undo（T013 で不要と確定）
- モード・フィルタの URL 同期（T018 / T055 は session 限定）
- コントラスト全面見直し・スクリーンリーダー監査の外注相当
- プレースホルダの三点リーダ統一だけ（本カードの主目的にしない）

## 作業ログ（追記のみ）

- 2026-08-23 planner: UI評価から起票。T013 の即削除は再燃させない
- 2026-08-23 planner: 人間「T062やって」。受け入れ条件は検証可能。
  見込み flow=本体行+80〜140 / 操作+2（skip / 空メッセージ） / 概念+0 /
  gzip +2KB未満 / Won't=No。しきい値内のためパケットなし → ready
- 2026-08-23 impl: 取得。task/T062 worktree でフォーカス床と見出しを揃える
- 2026-08-23 impl: 実装完了（7f1d0be）。左上ブランドを h1、skip link、タブ矢印、
  検索 3px ring、貼付スロットを button、発見ログ空の1行理由。
  実測 flow 本体 +103 / 操作 +2 / 概念 +0 / gzip +436B。しきい値内。
  check/test/smoke 緑。task/T062 を main へ merge → review
  確認は http://localhost:8002/ 。タブ・左上が `ARGBoard · 0.60+T062` であること。
  貼付スロットは button にしたのでクリックでもファイル選択が開く（…と同じ）。
  貼付とドラッグは従来どおり。
- 2026-08-23 impl: rework取得。検索の次がフィルタだと分からないので、
  フォーカス時に検索と同じ 3px ring を付ける
- 2026-08-23 impl: フィルタの :focus-visible に 3px ring（8328182）。task/T062 を main へ merge → review
  確認は http://localhost:8002/ を再読込。検索の次の Tab で「未配置のみ」に青い輪が付く。
- 2026-08-23 impl: rework取得。mac の Tab が button を飛ばして URL 欄へ行く。
  フィルタを checkbox、貼付スロットを file にして検索の次／入力の次に止まるようにする
- 2026-08-23 impl: フィルタを checkbox、貼付スロットを file に変更（aaaae73）。
  見た目とオンオフの意味は同じ。task/T062 を main へ merge → review
  確認は http://localhost:8002/ を再読込。検索の次の Tab が「未配置のみ」。
- 2026-08-23 impl: rework取得。人間「本文入力・検索・切り替えの3循環」。
  フィルタと貼付は Tab に入れない。Mac の Tab が button を飛ばすので、
  3点だけ preventDefault して回す

## 差し戻し履歴（追記のみ）

- 2026-08-23 human: 検索の次の Tab が貼付に見えない。フィルタと分からない → rework
- 2026-08-23 human: フィルタに行かずブラウザの URL 欄へ行く → rework
- 2026-08-23 human: 依然として URL 欄。本文入力・検索・切り替えの3循環でよいか → rework
