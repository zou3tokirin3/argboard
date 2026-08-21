---
id: T000
title: <動詞で終わる短い一文>
status: backlog    # backlog / ready / doing / review / rework / done / dropped
owner: none
gate: human        # human=人間の確認必須 / auto=reviewerが done 判定可
branch: ""
template_ver: generic-0.2
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

## 目的

<なぜやるか。1〜3行>

## 受け入れ条件

- [ ] <検証可能な条件を箇条書きで>
- [ ] flow しきい値（本体行 +200 / 操作 +3 / 概念 +2 / gzip +8KB / Won't）を意識し、超過見込みなら評価パケットへの人間GOが作業ログにある

## 確認観点（gate: human のとき）

表示: タブ・左上が **`ARGBoard · <release>+<id>`**（review 中）または **`ARGBoard · <release>`**（done 後）であること。
`<release>` は `ui/release.ts` の `APP_RELEASE`。review 中は `APP_PREVIEW` に本カード id を入れる。

- [ ] <人間が実機で確認する操作を3ステップ以内で>

## 作業ログ（追記のみ）

## 差し戻し履歴（追記のみ）
