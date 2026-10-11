---
id: T061
title: 狭い画面でもキャプチャまで手が届くようにする
status: done
owner: impl
gate: human
branch: "task/T061"
template_ver: generic-0.2
created: 2026-08-23
updated: 2026-10-11
---

## 目的

探索の核は「見つけた瞬間に1行で放り込む」。390px ではインストール案内・プロジェクト・
モード・JSON・キャプチャヒント・フィルタが積み上がり、ログの前にクロムが来る。
タッチ端末向けの床への手当ても無い。

出典: 2026-08-23 UI評価（web-design-guidelines + 実機スクショ）
関連: T016（考察のサイド／ボード圧迫。NOGOのまま。本カードは探索の縦クロム） /
[T064](T064-inspector-memo-while-image.md)（固定倍率拡大。本カードの後続） /
[T080](T080-stream-filter-chrome-rethink.md)（フィルタ帯は done。本カードの残りは案内・ヒント・床）
PLAN: モバイルは閲覧＋キャプチャができれば十分。ボード編集はデスクトップ優先

## 採択したやり方（人間確認・2026-10-11）

**A案から試す**（最小介入・TopBar非変更）:

1. タッチ（`pointer: coarse`）および狭幅（既存 `max-width: 800px`）で `capture-hint` を短文化。`⌘V` 等のデスクトップ専用ヒントを出さない
2. 画像スロット等の ⌘ 系ヒントも粗いポインタでは出さない（ファイル選択は残す）
3. **TopBar（プロジェクト／ブランド／JSON）は触らない**
4. キャプチャ固定・メニュー畳み込みは今回やらない
5. ルートに `touch-action: manipulation`、フルブリードに `env(safe-area-inset-*)`（`viewport-fit=cover`）
6. 成功判定: 390px・InstallTip を閉じたあとキャプチャ入力がファーストビューに入る。**入らなければ A 失敗 → B（JSON／プロジェクトをメニュー内へ畳む）を別GOで採択**。今回 B まで勝手にやらない
7. サムネ入口・拡大オーバーレイ・メモ編集は [T064](T064-inspector-memo-while-image.md)。順序は **T061(A) → T064**

### 見込み flow

本体行 +20〜60 / 操作 +0 / 概念 +0 / gzip +1KB未満 / Won't=No。
しきい値内 → 評価パケット不要。

## 受け入れ条件

- [x] 幅 390px 程度で、起動直後にキャプチャ入力がファーストビューに入る（インストール案内を閉じたあと）
- [x] 粗いポインタ（タッチ）では `⌘V` などデスクトップ専用ヒントを出さない。ファイル選択など代替が残る
- [x] ルートに `touch-action: manipulation` があり、ダブルタップズーム遅延が無い
- [x] フルブリード箇所に `env(safe-area-inset-*)` があり、ノッチで切れない
- [x] 既存のキャプチャ・フィルタ・JSON 書き出し／読み込みの機能は残る（場所は動かしてよい）
- [x] flow しきい値（本体行 +200 / 操作 +3 / 概念 +2 / gzip +8KB / Won't）を意識し、超過見込みなら評価パケットへの人間GOが作業ログにある

## 確認観点（gate: human のとき）

表示: タブ・左上が **`ARGBoard · <release>+<id>`**（review 中）または **`ARGBoard · <release>`**（done 後）であること。
`<release>` は `ui/release.ts` の `APP_RELEASE`。review 中は `APP_PREVIEW` に本カード id を入れる。

- [x] 390px 相当で起動し、案内を閉じたあと入力欄が見える
- [x] タッチ相当で `⌘` ヒントが消えている
- [x] デスクトップ幅では既存の探索レイアウトが破綻していない

## このカードでやらない

- 考察モードのサイド／インスペクタ圧迫（T016。再議論しない）
- モバイルでのボード編集を一人前にすること
- レスポンシブの全面書き直し
- JSON 書き出し／読み込みの廃止（T003 の常設バックアップは維持）
- 確認ダイアログ付き削除（T013 で不要と確定）
- TopBar の畳み込み・キャプチャ固定（B案。A 失敗時に別GO）
- サムネ入口分割・固定倍率拡大・オーバーレイ内メモ（T064）
- フィルタ帯の再設計（T080 done）

## 作業ログ（追記のみ）

- 2026-08-23 planner: UI評価から起票。T016とは対象を分ける（探索の縦クロム）
- 2026-10-11 human/planner: A案採択（ヒント抑制中心・TopBar非変更・足りなければB）。T064は後続。見込み flow しきい値内 → ready
- 2026-10-11 impl: 取得。worktree=.worktrees/T061（task/T061）で A案（ヒント短文化・touch/safe-area）を実装する
- 2026-10-11 impl: A実装完了（726eacd）。実測 390×844 で案内閉じ後入力 top≈176・FV内、ヒント無⌘、
  touch-action=manipulation。check/test/smoke 緑。flow 本体 +〜80行前後 / 操作+0 / 概念+0（ヒント床のみ）/
  gzip bundle +約2KB / Won't=No。しきい値内。task/T061 を main へ merge → review。
  確認は http://localhost:8000/ 。タブ・左上が `ARGBoard · 0.73+T061` であること。
- 2026-10-11 human: オッケー → done。APP_RELEASE 0.74、APP_PREVIEW 空。task/T061 branch 削除

## 差し戻し履歴（追記のみ）
