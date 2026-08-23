---
id: T063
title: 画像とフォントの初回ずれを止める
status: backlog
owner: none
gate: auto
branch: ""
template_ver: generic-0.2
created: 2026-08-23
updated: 2026-08-23
---

## 目的

スクショ `<img>` に寸法が無く、本文フォントは CSS `@import` で後から入る。
初回描画で要素が跳ねる。OS がダークのとき、ネイティブコントロールだけ色がずれる。

出典: 2026-08-23 UI評価（web-design-guidelines）
対象の目安: `ui/index.html` / `ui/styles.css` / `ui/capture.tsx` /
`ui/media-thumb.tsx` / `ui/card-image-field.tsx`

## 受け入れ条件

- [ ] カード／ステージング／サムネの `<img>` に width / height（または同等のアスペクト予約）がある
- [ ] IBM Plex を `@import` せず、`index.html` から `preconnect` ＋ stylesheet（`font-display: swap` 維持）
- [ ] `html` に `color-scheme: light` があり、スクロールバー／ネイティブ input がページ地色と揃う
- [ ] フォント系統（IBM Plex Sans JP / Mono）は変えない
- [ ] 既存 unit / smoke が緑
- [ ] flow しきい値（本体行 +200 / 操作 +3 / 概念 +2 / gzip +8KB / Won't）を意識し、超過見込みなら評価パケットへの人間GOが作業ログにある

## このカードでやらない

- デザイン系統の変更・新しいフォント
- ダークテーマの実装
- リスト仮想化
- モバイルクロム（T061）やフォーカス床（T062）

## 作業ログ（追記のみ）

- 2026-08-23 planner: UI評価から起票。見た目の系統は触らず、ずれだけ止める

## 差し戻し履歴（追記のみ）
