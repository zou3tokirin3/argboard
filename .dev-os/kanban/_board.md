# 盤面規約（_board.md）

template_ver: generic-0.2

## 列（status）

| status | 意味 | そこへ動かせる者 |
|---|---|---|
| backlog | 起票済み・未整理 | 誰でも起票可 |
| ready | 着手可能（受け入れ条件が書けている） | planner |
| doing | 作業中（branch / worktree 必須） | impl |
| review | 確認待ち | impl |
| rework | 差し戻し（理由が履歴に残っている） | reviewer / 人間 |
| done | 完了（merge済み） | gate:human は人間のみ / gate:auto は reviewer |
| dropped | 中止・棚上げ（理由が作業ログに残っている） | **人間のみ** |

## 遷移ホワイトリスト（これ以外の遷移は禁止）

```
backlog → ready → doing → review → done
                    ↑         │
                    └─ rework ←┘

どの列からでも → dropped（人間のみ）
dropped → backlog（人間のみ・復活）
```

- 飛び級禁止。特に →done への直行は不可
- 逆行は rework 経由のみ
- dropped へ動かすときは、理由を「作業ログ」に1行追記する

## 掟

1. **owner一人** — owner でない者はカード本文を変更しない（追記欄への追記は役割の権限に従う）
2. **追記のみ** — 作業ログ・差し戻し履歴は追記のみ。過去の行を書き換えない
3. **取得は1コミット** — ready のカードを取るときは owner と status を同時に書き換えて1コミットで宣言する
4. **人間ゲート** — `gate: human` のカードを done にできるのは人間だけ
5. **差し戻しは理由つき** — review→rework は「差し戻し履歴」への理由追記とセットでのみ有効
6. **盤面の正は main** — カードの変更（status・owner・追記）は必ず main 上で行い、コミットする。task ブランチ／worktree の中でカードを触らない（盤面が分裂する）

## worktree 規約

- doing の1カード ＝ 1ブランチ ＝ 1worktree
- ブランチ名: `task/<id>`（例: `task/T003`）
- 作成: `git worktree add ../<リポジトリ名>--<id> -b task/<id>`
- サンドボックスで親ディレクトリへ作れない場合は、リポジトリ内 `.worktrees/<id>` を正式な代替先とする
- merge 後は branch と worktree を削除する。カードの branch 欄は消さない（履歴として残す）

## done 前チェック

- 最新の実装コミットに対して check / test / smoke が緑である（カードに明示した例外を除く）
- PLANに影響する決定・UI変更は、done前にPLANへ同期されている
- 本体・テストのファイル数/行数が警告基準（15ファイル/3,000行・テスト別枠5/800）内である。超過見込みで実装した場合は、評価パケット（`.dev-os/budget-review-packet.md`）への人間GOが作業ログに残っていること（それが「明示承認」）
- マイルストーン境界、デザイン、公開URL、ドッグフードは `gate: human` とする
- review中に追加実装が必要になった場合、必ず理由を記録して rework → doing を経る
- merge後にbranch/worktreeを片付けてからdoneへ進める

## カード命名

- `kanban/cards/T<3桁連番>-<短いslug>.md`
- 連番は既存の最大値 +1（欠番は再利用しない）
