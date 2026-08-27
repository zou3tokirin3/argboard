---
id: T063
title: 画像とフォントの初回ずれを止める
status: done
owner: impl
gate: auto
branch: "task/T063"
template_ver: generic-0.2
created: 2026-08-23
updated: 2026-08-27
---

## 目的

スクショ `<img>` に寸法が無く、本文フォントは CSS `@import` で後から入る。
初回描画で要素が跳ねる。OS がダークのとき、ネイティブコントロールだけ色がずれる。

出典: 2026-08-23 UI評価（web-design-guidelines）
対象の目安: `ui/index.html` / `ui/styles.css` / `ui/capture.tsx` /
`ui/media-thumb.tsx` / `ui/card-image-field.tsx`

## 受け入れ条件

- [x] カード／ステージング／サムネの `<img>` に width / height（または同等のアスペクト予約）がある
- [x] IBM Plex を `@import` せず、`index.html` から `preconnect` ＋ stylesheet（`font-display: swap` 維持）
- [x] `html` に `color-scheme: light` があり、スクロールバー／ネイティブ input がページ地色と揃う
- [x] フォント系統（IBM Plex Sans JP / Mono）は変えない
- [x] 既存 unit / smoke が緑
- [x] flow しきい値（本体行 +200 / 操作 +3 / 概念 +2 / gzip +8KB / Won't）を意識し、超過見込みなら評価パケットへの人間GOが作業ログにある

## このカードでやらない

- デザイン系統の変更・新しいフォント
- ダークテーマの実装
- リスト仮想化
- モバイルクロム（T061）やフォーカス床（T062）

## 作業ログ（追記のみ）

- 2026-08-23 planner: UI評価から起票。見た目の系統は触らず、ずれだけ止める
- 2026-08-23 planner: 人間「T063実装して」。受け入れ条件は検証可能。
  見込み flow=本体行+20〜40 / 操作+0 / 概念+0 / gzip は bundle 非増 / Won't=No。
  しきい値内のためパケットなし → ready
- 2026-08-23 impl: 取得。task/T063 worktree で画像寸法・フォント先行読込・color-scheme を入れる
- 2026-08-23 impl: 実装完了（4784f11）。実測 flow 本体 +43 / 操作 +0 / 概念 +0 / gzip +118B。
  しきい値内。check/test/smoke 緑。task/T063 を main へ merge → review
- 2026-08-23 impl: rework取得。APP_PREVIEW を T063 にし、左上とタブで本変更だと分かるようにする
- 2026-08-23 impl: 表示ラベルを `0.60+T063` に変更（08f6b49）。task/T063 を main へ merge → review
  確認は http://localhost:8001/ 。タブ・左上が `ARGBoard · 0.60+T063` であること。
- 2026-08-23 impl: 人間「毎回最新版読み込みが出る」。localhost では SW を登録せず、残っていれば外す（90dfc13）。
  公開URLのPWAは従来どおり。8001 を建て直して確認。
- 2026-08-27 human: おおむね良さそう → done（gate: auto）。task/T063 worktree/branch 削除

## 差し戻し履歴（追記のみ）

- 2026-08-23 human: 8001も左上・タブが T058 のまま。T063 と分からない → rework
