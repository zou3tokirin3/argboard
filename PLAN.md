# ARG捜査ボード(仮称: argboard) — 実装計画書

> **この文書が唯一の仕様ソース。** 実装するAI/人間はこの文書に従うこと。
> ここに書かれていない機能は作らない。迷ったら「11. 実装ルール」と「12.
> Won'tリスト」を優先する。 状態: 計画のみ。実装は未着手。決定の経緯は「14.
> 決定ログ」参照。 **▶ 実装を始めるAIへ: まず末尾「付録A:
> M0キックオフ手順書」で足場(Deno導入・deno.json・git・ループ疎通)を組んでから、§9
> M0 の本作業に入ること。**
> この環境はDeno未インストール・git未初期化の状態から始まる(2026-07-04時点で確認済み)。

---

## 0. これは何か

**一行コンセプト**:
ARGを遊びながら、見つけたものを3秒で放り込み、あとで糸を張って考察する捜査ボード。**URLを開くだけで誰でも使え、データはその人のブラウザの中に残る**(サーバーにデータを送らない)。

**配布の要件(確定)**:
Webアプリの知識がない人でも「URLを知っていれば使える」こと。インストール・アカウント登録・サーバー構築を一切要求しない。

**開発スタイルの要件(確定)**:
ローカル環境でスモークE2Eを回しながら、AIエージェントが実装→機械検証→修正を自律ループする
**loopエンジニアリング** で作る(§10)。

検証したい核体験は3つだけ:

1. **ザクザク** — 見つけた瞬間に最小入力で放り込める(タイトル1行で完了)
2. **繋げる** —
   カードをボードに置き、ドラッグで糸を張り、糸にひとこと書ける(「同一人物?」「矛盾」)
3. **眺めて楽しい** — 開いた瞬間に捜査ボードの世界観があり、育っていくのが嬉しい

## 1. 前提: 前作の失敗と教訓

前作
`~/Developer/0_mine/argmemo_demo`(React+Vite+ReactFlow、2026-02〜03に頓挫)の分析結果。**このリポジトリは参照用アーカイブであり、コードは流用しない**(コンセプト文書
`docs/00_raw/ux_idea.md` と `docs/10_synthesis/pre_mvp_prototype.md`
のみ思想的な源流として有効)。

| 失敗                              | 証拠                                                                                                                             | 本計画での対策                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| E2Eテスト資産がプロダクトを食った | 全50コミット中、機能追加は約5個。残りはE2E修正・beads・AGENTS.md等。React FlowのドラッグE2Eが不安定でflaky修正ループが本流を停止 | E2Eは**スモーク5本上限・flaky即削除・網羅化禁止**(§10)。ドラッグ検証はテストフック経由で安定化 |
| スコープ膨張                      | 「Won't」宣言したera/階層/版管理UIが実装に侵入。69ファイル8,716行                                                                | 予算制: 本体15ファイル/2,500行(ルール11-3)。Won'tリスト明文化                                  |
| スタックが重い                    | node_modules+devサーバー必須。保守が仕事化                                                                                       | Deno単体ツールチェーン。外部依存はPreact系+Astralのみ                                          |
| デザイン後回し                    | gray-50の事務UI。触って楽しくない→使わない→検証不能                                                                              | M0でデザインモックを最初に作る。合格するまでコードを書かない                                   |
| ReactFlowのE2E地獄                | fix(e2e)コミットの山。使っていた機能は全体の5%                                                                                   | キャンバスはSVG自作(~400行)。テスタビリティを設計段階から組み込む(§10-3)                       |

**継承する設計原則**(前作の正しかった部分):

- 発見ログ(ストリーム)と解釈(ボード)の分離
- `foundAt` 自動記録・発見順が基本
- ボードは手動キュレーション(勝手に自動更新しない)
- 自動処理は「提案」まで。確定は必ずユーザー
- カード種別は最小限・階層でなくネットワーク
- UI用語はGit用語(コミット/ブランチ)を使わない

## 2. 配布形態(確定): 静的ホスティング+ブラウザ内保存

- **本線: GitHub Pages**。`deno task build` が吐く `dist/`
  を公開するだけ。無料・サーバー管理ゼロ・既存のGitHub運用に乗る
- 成果物は純粋な静的ファイル(HTML/JS/CSS)なので、**Cloudflare Pages / Deno
  Deploy 等へは `dist/` を置き直すだけで乗り換え可能**(§13 乗り換えマップ)
- ランタイムのサーバーは存在しない。データは各利用者のブラウザ内(IndexedDB)にのみ保存される
- M4で **PWA化**(manifest + Service
  Worker)し、オフライン動作と「ホーム画面/Dockに追加」を可能にする

### ⚠️ ブラウザ内保存の耐久性(重要・M0で検証)

「データが相手のブラウザに残る」の最大の敵は **SafariのITP:
サイトを7日間操作しないとscript-writableストレージ(IndexedDB等)を削除する**
ポリシー。対策を仕様に組み込む:

1. **`navigator.storage.persist()` を初回カード作成成功時に要求**(Safari
   17+/Chrome/Firefox対応)。永続モードが付与されれば7日削除の対象外
2. **PWAインストール(ホーム画面/Dock追加)で7日ルール免除**(M4で案内UIを出す)
3. **JSONエクスポートをヘッダー常設ボタンに**(1クリックでダウンロード=命綱)。インポートで完全復元できる
4. 参照: MDN Storage quotas / WebKit Storage Policy(§15)

## 3. 技術スタック(確定)

| 層                      | 選択                                                                                | 理由・備考                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| ランタイム/ツール       | Deno 2.9+ (mise管理)                                                                | fmt / lint / check / test / bundle 全部内蔵。設定は `deno.json` 一枚。node_modules無し                                |
| UI                      | Preact + @preact/signals                                                            | `deno.json` imports に `npm:preact` 系で指定。計~5KB。`preact/compat` でReact互換の逃げ道あり                         |
| ビルド                  | `deno bundle`(内蔵、esbuildベース、TSX対応)                                         | 不足があれば `npm:esbuild` に切替可                                                                                   |
| キャンバス              | SVG自作                                                                             | pan/zoom/ドラッグ/糸引きをpointer eventsで。目標~400行。ライブラリ禁止                                                |
| データ保存              | **IndexedDB**(自作薄ラッパー `ui/db.ts` ~120行)                                     | 非同期・容量十分・全ブラウザ対応。localStorage=容量/同期APIで不適、OPFS/SQLite-wasm=Worker必須で予算超過(§14決定ログ) |
| ロジックテスト          | `deno test`(`ui/db.ts`・`ui/state.ts`)                                              | UIコンポーネントの単体テストはしない                                                                                  |
| **スモークE2E**         | **Astral(`jsr:@astral/astral`)** — Denoネイティブのブラウザ自動化(CDP/headless対応) | loopエンジニアリングの「機械の目」(§10)。M0で検証し、不成立なら `npm:playwright` に切替                               |
| オフライン/インストール | PWA(manifest + Service Worker)                                                      | M4。Safari永続化の実質解でもある                                                                                      |
| CSS                     | 素のCSS 1ファイル + CSS custom properties                                           | Tailwind禁止。デザイントークン先行(§8)                                                                                |

## 4. アーキテクチャ

```
┌─ 利用者のブラウザ(誰のでも・どの端末でも) ─────────────┐
│  Preact UI (dist/ を GitHub Pages から配信)             │
│  ・signals でオンメモリ状態                              │
│  ・変更を500msデバウンス → db.ts.saveProject()          │
│  ・db.ts → IndexedDB(そのブラウザ内。外に出ない)        │
│  ・命綱: JSONエクスポート(DL) / インポート(復元)        │
└─────────────────────────────────────┘
開発時のみ: deno task dev = deno bundle --watch + ローカル静的サーバー(serve.ts)
スモークE2E: deno task smoke = build → serve.ts起動 → Astral(headless)がlocalhostを叩く
```

- ランタイムにバックエンドはない。`serve.ts`
  は開発・テスト時のローカル配信専用(~20行)
- シングルユーザー前提。競合制御はしない

### ファイル構成(このまま作る)

```
argboard/
├── deno.json          # tasks: dev / build / check / test / smoke
├── PLAN.md            # この文書
├── README.md          # プロダクトの説明だけを書く(開発インフラの話は書かない)
├── serve.ts           # 開発・テスト用ローカル静的サーバー(本番では使わない)
├── ui/
│   ├── index.html
│   ├── main.tsx       # Preact root・探索/考察モード切替・テストフック公開(?test=1時のみ)
│   ├── types.ts       # §5の型定義
│   ├── db.ts          # IndexedDB薄ラッパー + navigator.storage.persist()要求
│   ├── state.ts       # signals・デバウンス保存・export/import
│   ├── capture.tsx    # クイック入力
│   ├── stream.tsx     # 発見順リスト+検索
│   ├── board.tsx      # SVGキャンバス(自作)
│   ├── inspector.tsx  # 選択カード/糸の編集パネル
│   └── styles.css     # デザイントークン+全スタイル
├── tests/
│   ├── unit/          # db.test.ts / state.test.ts(deno test)
│   └── smoke.ts       # スモークE2E(Astral、最大5シナリオ、deno task smoke)
└── dist/              # deno bundle 成果物(gitignore、GitHub Pagesへはこれを公開)
```

**予算**: アプリ本体(ui/ +
serve.ts)は15ファイル/2,500行以内。**テスト(tests/)は別枠で5ファイル/800行以内**。M4でPWA化する際に
`ui/manifest.json` と `ui/sw.js` を追加。

## 5. データモデル(確定・3+1型のみ)

1 ARG = 1プロジェクト。IndexedDB(DB名 `argboard`、objectStore
`projects`、key=id)に
**Project全体を1レコードとして保存**する。テキスト中心で数MB以下の想定なので全置換保存で問題ない。この単純さが乗り換え可能性の担保でもある(エクスポートされるJSONと保存形式が同一)。

```ts
type Project = {
  version: 1; // スキーマ版(マイグレーション用)
  id: string;
  name: string;
  createdAt: number;
  cards: Card[];
  links: Link[];
  boards: Board[];
  ui?: { mode: "explore" | "contemplate"; sideOpen?: boolean }; // 画面モード(プロジェクト単位)
};

type Card = {
  id: string; // crypto.randomUUID()
  title: string; // 必須はこれだけ
  body?: string; // 考察メモ(プレーンテキスト)
  url?: string; // タイトルは手入力(OGP自動取得は静的構成では不可。§12)
  image?: string; // URL文字列のみ(ローカル画像保存はWon't)
  tags?: string[];
  foundAt: number; // 自動付与・以後不変(発見順の根幹)
};

type Link = {
  id: string;
  from: string; // Card.id
  to: string; // Card.id
  label?: string; // 自由記述:「同一人物?」など
  kind: "connects" | "contradicts";
  createdAt: number;
};

type Board = {
  id: string;
  name: string;
  cardIds: string[]; // 手動キュレーション。自動追加しない
  positions: Record<string, { x: number; y: number }>;
  viewport?: { x: number; y: number; zoom: number };
};
```

## 6. ストレージ契約(乗り換え可能性の要)

`ui/db.ts`
はこのインターフェースだけを公開する。**将来ストレージを乗り換える時(同期エンジン/OPFS/Denoバックエンド等)は、このファイル1枚を差し替えれば済む**構造を守ること。UI側がIndexedDBのAPIに直接触れるのは禁止。

```ts
interface Store {
  listProjects(): Promise<
    { id: string; name: string; cardCount: number; updatedAt: number }[]
  >;
  loadProject(id: string): Promise<Project | null>;
  saveProject(p: Project): Promise<void>; // 全置換。デバウンスは呼び出し側(state.ts)
  deleteProject(id: string): Promise<void>;
  requestPersistence(): Promise<boolean>; // navigator.storage.persist() ラップ
}
```

- エクスポート: Project を整形JSONで `<プロジェクト名>.json` としてダウンロード
- インポート: ファイル選択/ドラッグ&ドロップ → `version`
  フィールドを見てマイグレーション → 新規プロジェクトとして取り込み
- 保存失敗(容量等)はtoastで通知し、エクスポートを促す

## 7. 画面仕様

**探索／考察の2モード構成**。ARGプレイの流れに合わせ、探索で手がかりを溜め、考察でボードに貼って考える。常時2ペインにはしない。モードはプロジェクト単位で保存し、リロード後も残る。

核導線は「探索で発見ログに溜める → 考察でボードに置き、置いたカード同士に糸を張る」。

### 探索モード(ザクザク)

- ボードは出さない。発見ログ(将来は表)を主面にする
- 最上部にキャプチャ入力(常設1行)。Enterで即作成(`title`のみ、`foundAt`自動)。`Cmd+K`
  でどこからでもフォーカス
- URLをペーストした場合は `url` フィールドに入れ、タイトルは手入力(自動取得なし)
- 下は発見順(新しい順)のカードリスト。検索ボックス(title/body/tags/url対象、絞り込みのみ)
- ボード配置済みカードにはマーク表示(配置操作自体は考察モード側)

### 考察モード(繋げる)

- ボードを主面にする
- 発見ログ／カード一覧はサイドとして折りたたみ／展開できる(既定は閉じてよい)
- SVGキャンバス。パン=背景ドラッグ、ズーム=ピンチ/Ctrl+ホイール
- カードノード: ドラッグで移動(位置は `Board.positions` に保存)。探索サイド／発見ログからボードへドラッグ配置
- 糸: ノード縁のハンドルからドラッグ(ゴムバンド表示)→ 相手ノードで離すと `Link`
  作成(既定 `connects`)
- 糸クリック→ポップオーバーでラベル編集・`contradicts`
  切替(矛盾は色が変わる)・削除
- カード選択→簡易編集(少なくとも `title` / `body`)。本格インスペクタ(`url/tags`等)はM3
- ボードは複数作成可(タブ切替)。ただしM2までは1枚固定でよい(複数化はM3)

### ヘッダー(常設)

- **探索／考察のモード切替** / プロジェクト切替 / **エクスポートボタン(1クリックDL)** / インポート

### カード対応(dev-os)

- T003(M1) = 探索モードのザクザク体験を完成させる
- T004(M2) = 考察モードのボード配置・糸張りを完成させる
- T005 = モード切替の骨格(本文書の方針確定を含む)

## 8. デザイン(今回の新規投資領域)

- **世界観**:
  事件捜査ボード。ダーク基調、紙質感の証拠カード、赤い糸、琥珀のアクセント。ARGは暗号・座標・IDが頻出なので等幅フォントの混植が映える
- **方針**: 色8個・余白スケール・角丸・影・フォント2種(Noto Sans JP + JetBrains
  Mono系)をCSS custom propertiesとして `styles.css`
  冒頭に定義してから部品を作る。具体値は**M0のモックで確定**する(この文書に転記して確定扱いにする)
- **マイクロインタラクションは機能である**:
  カード追加時にスッと滑り込む/糸を引くときのゴムバンド/ホバーで繋がったカードがふわっと光る。M4の「磨き」スコープに正式に含める(削らない)
- モバイルSafariでも崩れないこと(閲覧+キャプチャができれば十分。ボード編集はデスクトップ優先)

## 9. マイルストーン

マイルストーンの**合格判定は人間のドッグフーディング**(実際のARGまたは過去ARGのアーカイブを1セッション遊びながら使う)。スモークE2Eは「壊れていないこと」の確認であって「体験が良いこと」の確認ではない
— この区別を崩さない。

| M      | 内容                                                                                                                                                                                                                                                                                                                                                                                   | 完了条件                                                                                                                                                 |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M0** | (a) デザインモック: 静的HTML1枚+ダミーデータで見た目だけ作る。(b) 保存・配布スパイク: `db.ts` 原型でIndexedDB保存と `navigator.storage.persist()` の挙動をChrome/Safariで確認。hello worldの `dist/` をGitHub Pagesに置き別端末で開く。(c) **ループ検証: Astralでlocalhostのページを開いてassertするスモーク1本が `deno task smoke` で緑になる**(不成立なら`npm:playwright`へ切替判断) | (a) 自分が「これなら毎日触りたい」と思える。(b) URLを開くだけで動き、リロードでデータが残ることを2ブラウザで確認。(c) check→test→smokeのループが一周する |
| M1     | 探索(ザクザク): キャプチャ+発見ログ+db.ts本実装+プロジェクト作成/切替+**エクスポート** | 探索モードで3秒で1枚作れる。リロードしても消えない。persist()要求済み。スモーク緑 |
| M2     | 考察(繋げる): ボード(パン/ズーム/配置)+糸張り+サイド折りたたみ | 考察モードで発見ログ→ボードのドラッグ、糸作成が気持ちよく動く。スモーク緑 |
| M3     | 考察を深める: 糸ラベル/種別切替/本格インスペクタ/ボード複数化+**インポート** | 考察が言葉として残る。エクスポート→インポートで完全復元。スモーク緑 |
| M4     | 磨き: ショートカット、アニメ、削除undo(toast)、空状態、**PWA化**                                                                                                                                                                                                                                                                                                                       | 1本のARGを通しで遊んで体験が途切れない。ホーム画面追加でSafari 7日問題が実質解消                                                                         |

## 10. 開発ループ(loopエンジニアリング運用)

AIエージェントが「実装→機械検証→修正」を自律ループする。人間はマイルストーン境界のドッグフーディングとデザイン判断だけ行う。

### 10-1. ループの定義

```
1タスク実装
  → deno task check   (fmt + lint + 型チェック)
  → deno task test    (ロジックのユニットテスト)
  → deno task smoke   (build → serve.ts → Astral headless で核体験シナリオ実行)
  → 全部緑 → コミット → 次のタスク
  → 赤 → 修正(ただし10-2のガードレール内で)
```

`deno task smoke`
は本番同等ビルド(`dist/`)に対して実行する。CIはセットアップしない(ローカル専用ループ)。

### 10-2. ガードレール(前作の敗因を遮断する)

前作はE2E資産の無制限増殖とflaky修正で本流が停止した。同じ穴に落ちないための硬い制約:

1. **スモークは常に5本以内**。対象は核体験シナリオのみ(例:
   ①カード作成→リロードで残る ②ストリーム→ボード配置 ③糸を張る→ラベル
   ④エクスポートJSONの中身
   ⑤プロジェクト切替)。6本目を足したくなったら古い1本を削る
2. **flaky即削除ルール**:
   スモークが不安定化したら、修正は1ループ分まで。それで安定しなければ**そのテストを削除**し、README末尾の手動確認リストに1行降格させる。「テストを直すために本流を止める」ことを構造的に不可能にする
3. **網羅化禁止**:
   エッジケース・エラーパス・UIバリエーションのE2Eは書かない。それらはユニットテスト(ロジック)か手動確認の領分
4. **テストのためにアプリを歪めない**。ただし§10-3のテスタビリティ装備(フック・属性・アニメ無効化)は「歪み」ではなく設計の一部として最初から入れる

### 10-3. テスタビリティ設計(最初から組み込む)

前作の地獄の入り口は「ポインタードラッグの物理シミュレーション」だった。今回はここを設計で回避する:

- **テストフック**: `?test=1` 付きで開いた時だけ `window.__argboardTest`
  を公開する
  ```ts
  window.__argboardTest = {
    getState(): Project;                       // signalsの読み取りスナップショット
    placeCardOnBoard(cardId, x, y): void;      // ドラッグ配置と同じコードパスを呼ぶ
    connectCards(fromId, toId): void;          // 糸張りと同じコードパスを呼ぶ
    flushSave(): Promise<void>;                // デバウンス待ちを飛ばす
  };
  ```
- スモークからの操作は**クリック・キー入力・テキスト入力まで**。ドラッグ系の検証はフック経由で行う(UIハンドラと同じ関数を呼ぶので、検証価値は保ちつつ座標シミュレーションの不安定さを排除)。本物のポインタードラッグのスモークは**最大1本だけ**(操作系が生きていることの生存確認)
- 主要要素に `data-testid` を付与(capture-input / stream-card / board-node /
  link-line / export-btn)
- `?test=1`
  時はCSSアニメーション・トランジションを無効化(待ち時間とタイミング起因のflakyを根絶)
- スモーク内の待機は「状態が変わるまで」のポーリング(フックの
  `getState`)で行い、固定スリープ禁止

## 11. 実装ルール(再発防止・違反はレビューで差し戻す)

1. E2Eは§10の枠内のみ(スモーク5本・flaky即削除・網羅化禁止)。**この枠を超えるテスト基盤の整備・CI構築・テストランナー乗り換え検討を勝手に始めない**
2. 課題管理ツール・エージェント運用ファイル(beads / AGENTS.md /
   .sisyphus類)を持ち込まない。TODOはREADME末尾の箇条書きまで
3. **予算制:
   本体15ファイル/2,500行、テスト別枠5ファイル/800行**(dist除く)。超えそうなら機能・テストを足す前に削る
4. READMEにはプロダクトの話だけを書く(開発ツール運用・ベンチマーク等を書かない)
5. 機能追加は「実プレイで実際に困ったこと」起点のみ。「将来の拡張ポイント」からは足さない
6. **静的配布を壊す変更禁止**:
   ランタイムにサーバーを要求する機能は入れない(入れたくなったら§13の乗り換えマップに従いDeno
   Deploy移行として別途計画)
7. 依存追加はPreact系+Astral以外原則禁止。欲しくなったら、まず自作で何行かを見積もる
8. UIコードがIndexedDB APIに直接触るの禁止(§6のStore契約経由のみ)

## 12. Won'tリスト(v1で作らない・提案もしない)

- ビューの版管理(ViewVersion) — JSONエクスポートの手動保存で代替
- 共同編集・同期・クラウド保存・アカウント
- **OGPタイトル自動取得** — 静的構成ではCORSで不可能。Deno
  Deploy乗り換え時の拡張候補として§13に記録
- 名寄せ/Entity辞書・カードの親子階層・Era/時代概念
- タイムラインビュー
- ローカル画像ファイルの取り込み保存(URLのみ)
- 全文検索の高度化(単純な部分一致で足りる)
- 自動レイアウト(force等)
- SQLite-wasm / OPFS(現規模では複雑さに見合わない)
- **網羅的E2Eテストスイート・CI/CD・カバレッジ計測**(スモーク5本が上限)

## 13. 乗り換えマップ(発展性の担保)

各層が独立に乗り換え可能であること自体を設計目標とする。**共通の契約は「§5のProject
JSONスキーマ(versionフィールド付き)」**。

| 層           | 現在             | 乗り換え先(将来)                                       | 乗り換えコスト                                            |
| ------------ | ---------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| ホスティング | GitHub Pages     | Cloudflare Pages / Deno Deploy / 任意の静的ホスト      | `dist/` を置き直すだけ                                    |
| サーバー機能 | なし(純静的)     | Deno Deploy(同一Denoツールチェーン)に `main.ts` を足す | OGP取得・共有リンク等が解禁。UIは無変更                   |
| ストレージ   | IndexedDB(db.ts) | 同期エンジン(CRDT系) / OPFS+SQLite-wasm / サーバー保存 | `db.ts` 1ファイルの差し替え(§6契約)                       |
| UIライブラリ | Preact           | React(`preact/compat` 経由)                            | 最悪時の保険                                              |
| E2Eランナー  | Astral           | `npm:playwright`                                       | smoke.tsの書き換えのみ(シナリオ5本なので小さい)           |
| 包装         | Webアプリ        | PWA(M4で実施) / deno desktop(Deno 2.9+, experimental)  | 同一コードのまま被せるだけ。IndexedDBはwebview内でも動く  |
| データ       | ブラウザ内       | 別ブラウザ/別端末へ                                    | エクスポートJSON→インポート(唯一の移送手段として常に維持) |

## 14. 決定ログ

- **2026-07-03 初版**:
  ブラウザ完結・単一HTML出力案(前作argmemo_demoの失敗分析に基づく)
- **2026-07-03 改訂1**: Deno 2.9の `deno desktop`
  を知り、macOSデスクトップアプリ前提+ローカルJSONファイル保存に変更
- **2026-07-03 改訂2**:
  真の要件が「URLを知っていれば誰でも使える気軽な配布+データは相手のブラウザ内」と確定。deno
  desktopはバイナリ配布(DL+Gatekeeper+署名問題)で要件を満たさないため**任意の包装オプションに降格**し、静的ホスティング+IndexedDBを本線に再改訂。ストレージはリサーチの結果IndexedDBを採用(localStorage=容量/同期APIで不適、OPFS/SQLite-wasm=Worker必須で予算超過)。Safari
  7日削除問題は persist()+PWA+エクスポート常設の三段構えで対処
- **2026-07-03 改訂3**:
  開発スタイルとして**loopエンジニアリング(ローカルでE2Eを回すAI自律ループ)を採用**。全面禁止だったE2Eを「スモーク5本上限・flaky即削除・フック経由操作・網羅化禁止」のガードレール付きで解禁(§10)。前作の敗因は「E2Eという手段」ではなく「E2E資産の無制限増殖とflaky修正による本流停止」だったため、量と修正コストに構造的な上限を設ける形で両立。ランナーはDenoネイティブのAstralを第一候補(M0で検証、不成立ならnpm:playwright)
- **2026-07-04 改訂4**:
  この計画を**別の作業用AIへ引き渡す前提**が確定。環境を確認したところ「argboardはPLAN.md1枚・git未初期化・Deno未インストール(miseにも無し)」の状態で、計画は完全な"仕様書"だが冷えたAIが即着手できる"手順書"ではなかった。ギャップを埋める**付録A(M0キックオフ手順書)**を追記。あわせて
  `deno bundle` がDeno
  2.9に実在すること(`--platform browser`/`--declaration`対応)を確認し、ビルド手段の前提を裏付けた。プロジェクトの場所はこのまま(`~/Developer/0_mine/argboard`)で確定
  — 隣接する `argmemo_demo`
  は絶対パス参照の読み取り専用アーカイブで、Denoのプロジェクト隔離により汚染リスクなし
- **2026-07-12 改訂5(現行)**:
  画面の正を「常時2ペイン」から**探索／考察の2モード切替**に変更(§7)。探索=発見ログ主面(将来は表)、考察=ボード主面+サイド折りたたみ+簡易編集。モードはプロジェクト単位で保存。表部品の選定は後続。dev-osでは T005 が骨格、T003=探索(M1)、T004=考察ボード(M2)

## 15. 参照

- Safariストレージポリシー:
  https://webkit.org/blog/14403/updates-to-storage-policy/
- ストレージ削除基準(MDN):
  https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- ブラウザストレージ比較:
  https://rxdb.info/articles/localstorage-indexeddb-cookies-opfs-sqlite-wasm.html
- Astral(スモークE2Eランナー): https://jsr.io/@astral/astral /
  https://astral.deno.dev/
- deno desktop(乗り換え候補として): https://docs.deno.com/runtime/desktop/
- 前作アーカイブ:
  `~/Developer/0_mine/argmemo_demo`(コード流用禁止・コンセプト文書のみ参照可)

## 16. 未確定事項(実装開始時に決める)

- アプリ名(「argboard」は仮)・公開URL(GitHub Pagesのリポジトリ名)
- デザイントークンの具体値(M0で確定→§8に転記)
- Astralの実用性(M0スパイク(c)で判定。ヘッドレスChromeの取得方法含む)
- PWAのオフラインキャッシュ範囲(M4、アプリシェルのみで十分の見込み)

---

## 付録A: M0キックオフ手順書(冷えたAI向けブートストラップ)

> **このセクションは「仕様」ではなく「足場を組む手順」。**
> 実装を引き継ぐAIは、§9 M0
> の本作業(デザインモック等)に入る**前に**、ここを上から順に実行して環境を立ち上げること。
> **注意**: 環境は 2026-07-04 時点で「PLAN.md
> 1枚・git未初期化・Deno未インストール」。以下のコマンドは足場の**意図**を示すもので、フラグ・指定子の細部は実行時に
> `deno --help` /
> 各READMEで最終確認すること(逐語のコマンド保証ではない)。作業ディレクトリは常に
> `~/Developer/0_mine/argboard`。

### Step 1. Deno導入(mise管理)

```bash
cd ~/Developer/0_mine/argboard
mise use deno@2        # .mise.toml に記録。Deno 2.9+ が入る
deno --version         # 2.9 以上であることを確認(deno desktop/bundleは2.9必須)
```

- ユーザーのグローバル方針は「Node系は pnpm、npm/npx 禁止」だが、**Denoは npm
  CLI を使わず `npm:`
  指定子をネイティブ解決する**ため抵触しない。Preact/Astralの取得に npm/pnpm
  は不要。

### Step 2. git初期化

```bash
git init
printf 'dist/\n.DS_Store\n.mise.toml\n' > .gitignore   # dist はビルド成果物、Pagesへは別途公開
```

- §10のループが「緑→コミット」前提なので、ここでリポジトリを用意しておく。

### Step 3. `deno.json` を作る(下記を土台にする)

```jsonc
{
  "tasks": {
    "dev": "deno run -A serve.ts",
    "build": "deno bundle --platform browser ui/main.tsx dist/bundle.js",
    "check": "deno fmt --check && deno lint && deno check ui/main.tsx",
    "test": "deno test -A tests/unit/",
    "smoke": "deno task build && deno run -A tests/smoke.ts"
  },
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "preact"
  },
  "imports": {
    "preact": "npm:preact@^10",
    "preact/": "npm:/preact@^10/",
    "@preact/signals": "npm:@preact/signals@^1"
  }
}
```

- **検証事項**: `deno bundle` はJS/TSをまとめるだけで、`index.html` /
  `styles.css` は扱わない。よって実際の `build` タスクは「(1)
  main.tsxをbundle.jsに束ねる (2)
  index.htmlとstyles.cssをdist/へコピー」の2段になる。`dist/` に `index.html` /
  `bundle.js` / `styles.css` の3点が揃えばGitHub Pagesにそのまま載る。
- `jsxImportSource: "preact"` は `preact/jsx-runtime` に解決される(上の
  `"preact/"` マッピングが要る)。

### Step 4. 最小スケルトン(M0の"器")を置く

- **`serve.ts`**(~20行): `Deno.serve` で `dist/`(または開発時は
  `ui/`)を配信するだけ。`?test=1` はそのまま素通し。本番では使わない。
- **`ui/index.html`**: `#app` と `bundle.js` / `styles.css` を読むだけ。
- **`ui/main.tsx`**: Preactで `Hello ARGBoard` を1行renderするだけ。
- 確認: `deno task build && deno task dev` → localhost で "Hello ARGBoard"
  が出る。

### Step 5. ループの土台(§10)が一周するか疎通させる ← M0の核心

```bash
deno add jsr:@astral/astral                 # AstralをdenoのimportsへE追加
```

- **`tests/unit/placeholder.test.ts`**: `Deno.test` で自明なassert1本(`test`
  タスクの配線確認)。
- **`tests/smoke.ts`**: Astralでlocalhost(serve.ts)を開き、"Hello ARGBoard"
  の存在をassertする1本。§10-3のガードレール(固定スリープ禁止・状態ポーリング・アニメ無効化)は最初から守る。

```bash
deno task check && deno task test && deno task smoke   # 3つとも緑になるか
```

- **最重要の検証点**:
  Astralが初回に**ヘッドレスChromiumを取得できるか**。ここが§9
  M0スパイク(c)そのもの。取得や起動に失敗し1ループで直らなければ、§13乗り換えマップに従い
  `npm:playwright`
  へ切替(smoke.tsの書き換えのみで済む)。**ここで沼にはまってM0本作業を止めないこと**(前作の教訓の直接適用)。

### Step 6. 足場をコミットして本作業へ

```bash
git add -A && git commit -m "chore: M0 skeleton — deno + preact + astral loop green"
```

### 完了条件(この付録を"抜けた"と言える状態)

- `deno task check && deno task test && deno task smoke` が**緑で一周**する
- localhost に器(Hello ARGBoard)が出て、Astralがそれを機械的に確認できている

ここまで到達して初めて、§9 M0 の本題(**(a) デザインモック** / **(b)
IndexedDB保存 & `navigator.storage.persist()` スパイク** /
(c)はこの付録で達成済み)に進む。以降は §10 の開発ループに乗せて M1→M4 を回す。
