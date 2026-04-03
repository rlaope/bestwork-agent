# bestwork-agent

Claude Codeのための最高のハーネスエンジニアリング。サークルではなく企業のように働く。

<p align="center">
  <a href="README.md">English</a> · <a href="README.ko.md">한국어</a> · <a href="README.ja.md">日本語</a>
</p>

---

AIエージェントは一人で作業します。ハルシネーション、ループ、要件の見落とし — 終わってから気づきます。

**bestwork-agent**はエージェントをチームに変えます。すべてのタスクに**Tech**（エンジニア）+ **PM**（プロダクトマネージャー）+ **Critic**（品質レビュアー）が割り当てられます。49の専門エージェント。自動選択。並列実行。フィードバックループ。リアルタイム通知。

## インストール

### 方法1: Claude Codeプラグイン（推奨）

```
/plugin marketplace add https://github.com/rlaope/bestwork-agent
/plugin install bestwork-agent
```

### 方法2: npm

```bash
npm install -g bestwork-agent
bestwork install
```

Claude Codeを再起動後、`./help`を入力。

---

## ハーネス

### トリオ実行 — AI企業

```
./trio implement auth API | add rate limiting | write integration tests
```

各タスクにドメイン専門家トリオを自動マッチング：

- **Tech** — ドメイン専門知識で実装
- **PM** — 要件充足を検証
- **Critic** — 品質レビュー + ハルシネーション検出
- 却下？フィードバックループ → Tech修正 → 再レビュー（最大3回）

### 49の専門エージェント

```bash
bestwork agents    # フルカタログ
```

**25 Tech**: backend, frontend, fullstack, infra, database, API, mobile, testing, security, performance, devops, data, ML, CLI, realtime, auth, migration, config, agent-engineer, plugin, accessibility, i18n, graphql, monorepo, writer

**10 PM**: product, API, platform, data, infra, migration, security, growth, compliance, DX

**14 Critic**: performance, scalability, security, consistency, reliability, testing, hallucination, DX, type safety, cost, accessibility, devsecops, i18n, agent

### 開発コントロール

| コマンド | 説明 |
|----------|------|
| `./scope src/auth/` | ディレクトリへの編集をロック |
| `./unlock` | スコープロック解除 |
| `./strict` | 全ガードレール有効化 |
| `./relax` | ストリクトモード無効化 |
| `./tdd add auth` | TDD（テスト駆動開発）フロー |
| `./context [files]` | ファイルコンテキストプリロード |
| `./recover` | 行き詰まり？アプローチリセット |
| `./review` | プラットフォーム/ランタイムのハルシネーションチェック |

### スマートゲートウェイ

コマンドの暗記不要。自然言語で入力：

```
"review my code"           → ./review
"run in parallel"          → ./trio
"why did it fail"          → ./autopsy
"improve my prompts"       → ./learn
```

### 通知

```
./discord <webhook_url>
./slack <webhook_url>
```

### ハルシネーション防止（自動）

- **グラウンディング** — 未読ファイルの編集時に警告
- **バリデーション** — コード変更ごとに自動タイプチェック
- **プラットフォームレビュー** — セッション終了時にOS/ランタイム不一致を検出

---

## オブザーバビリティ

```bash
bestwork                  # TUIダッシュボード
bestwork sessions         # セッション一覧
bestwork session <id>     # ツール使用分布、エージェントツリー
bestwork summary -w       # 週間概要
bestwork heatmap          # 365日アクティビティグリッド
bestwork loops            # エージェントループ検出
bestwork replay <id>      # セッションリプレイ
```

---

## セキュリティ

すべてのデータはローカル。外部送信なし。[SECURITY.md](SECURITY.md)参照。

## ライセンス

[MIT](LICENSE)
