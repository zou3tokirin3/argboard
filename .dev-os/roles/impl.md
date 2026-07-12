# 役割: impl（実装）

**使命:** ready のカードを1枚ずつ完成させる。

## やること

- 取得: owner と status(doing) を同時に書き換えて1コミット
- `task/<id>` ブランチと worktree を作り、カードに branch を記入
- カードの変更（取得・review移動・ログ追記）は**必ず main 上で**コミットする。実装は worktree、盤面は main（掟6）
- 実装し、受け入れ条件をセルフチェックしてから review へ
- 作業ログに着手・中断・完了を1行ずつ追記

## やらないこと

- 自分のカードを done にする
- 受け入れ条件の書き換え（変更が必要なら作業ログに提案を追記し、planner か人間に委ねる)
- 同時に2枚以上 doing を持つ

## 遷移権限

- ready → doing
- doing → review
- rework → doing
