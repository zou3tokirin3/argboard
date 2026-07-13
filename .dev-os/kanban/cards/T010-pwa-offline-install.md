---
id: T010
title: PWAとしてオフライン利用できるようにする
status: backlog
owner: none
gate: human
branch: ""
template_ver: generic-0.2
created: 2026-07-13
updated: 2026-07-13
---

## 目的

アプリシェルをオフライン起動でき、ホーム画面/Dockへ追加できる状態にする。
ブラウザ内保存の耐久性を補うM4の本線とする。

## 受け入れ条件

- [ ] manifestとService Workerを追加し、GitHub Pages配下のパスで動く
- [ ] 一度オンラインで開いた後、オフラインでアプリシェルを起動できる
- [ ] Chrome系とSafari系の対象環境でホーム画面/Dock追加を確認する
- [ ] 更新時に古いアプリシェルへ固定されないキャッシュ方針を一文でPLANへ記録する
- [ ] 15ファイル / 3,000行のv1絶対上限を守る
- [ ] 最新コミットで check / test / smoke が緑
- [ ] 人間が公開URLでオフライン起動を確認する

## 作業ログ（追記のみ）

- 2026-07-13 planner: M4の耐久性タスクとして起票。depends on T009

## 差し戻し履歴（追記のみ）
