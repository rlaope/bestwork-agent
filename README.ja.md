# bestwork-agent

Claude Codeのためのハーネスエンジニアリング。プロンプト一行で十分 — 残りはハーネスがキャッチします。

<p align="center">
  <a href="README.md">English</a> · <a href="README.ko.md">한국어</a> · <a href="README.ja.md">日本語</a>
</p>

---

## 問題

AIコーディングエージェントはハルシネーション、ループ、要件漏れ、セキュリティ欠陥を生み出します。AI生成コードの45%に脆弱性が含まれています（Veracode）。バイブコーディングアプリはアイデア検証なしで作られ、失敗します。

**bestwork-agent**はプロのエンジニアリングチームが使う品質ゲートを追加します — 作業方法は変えずに。

## ベンチマーク：ハーネスON vs OFF

```
═══════════════════════════════════
  HARNESS EFFECTIVENESS BENCHMARK
═══════════════════════════════════

  シナリオ:      13
  精度:          100.0%

  ハーネスON:
    キャッチ率:   100% (10/10)
    誤検出:       0

  ハーネスOFF (バニラ):
    キャッチ率:   0% (0/10)

  カテゴリ:
    ハルシネーション 3/4 キャッチ
    プラットフォーム 4/4 キャッチ
    非推奨         1/1 キャッチ
    セキュリティ    1/1 キャッチ
═══════════════════════════════════
```

自分で実行: `npm run benchmark`

## ハーネスの機能

| ゲート | タイミング | キャッチ対象 |
|--------|-----------|-------------|
| **グラウンディング** | PreToolUse (Edit/Write) | 未読ファイルの編集 |
| **スコープロック** | PreToolUse | ロックディレクトリ外の編集 |
| **ストリクト** | PreToolUse | `rm -rf`、`git push --force` |
| **タイプチェック** | PostToolUse (Edit/Write) | 変更後のTypeScriptエラー |
| **レビュー** | オンデマンド / PostToolUse | 偽import、ハルシネーションメソッド、プラットフォーム不一致 |
| **要件チェック** | PostToolUse (Edit/Write) | clarify/validateセッションの未達要件 |
| **検証** | ビルド前 | エビデンスベースのgo/no-go — この機能は作る価値があるか？ |

すべてのゲートは自動実行されます。プロンプトを入力するだけです。

## インストール

### 方法1: Claude Codeプラグイン（推奨）

```bash
/plugin marketplace add https://github.com/rlaope/bestwork-agent
/plugin install bestwork-agent
```

### 方法2: npm

```bash
npm install -g bestwork-agent
bestwork install
```

## 仕組み

ゲートウェイがプロンプトを分析し、適切なスケールを選択します：

- **Solo** — 簡単な修正（エージェント1名）
- **Pair** — 関連する2タスク（エージェント2名 + クリティック）
- **Trio** — 品質ゲート付き複数タスク（タスクごとにtech + PM + critic）
- **Hierarchy** — 大規模、アーキテクチャ決定（CTO → Lead → Senior → Junior）
- **Squad** — ローカル機能、高速コンセンサス（フラット、並列）

## 49ドメインスペシャリスト

**25 Tech** · **10 PM** · **14 Critic**

エージェントプロンプトは`prompts/`にあり、ビルドなしで編集可能。

## 22スキル

自然言語またはスラッシュコマンド — ゲートウェイが自動ルーティング。

| スキル | 機能 |
|--------|------|
| `validate` | ビルド前のエビデンスベース機能検証 |
| `clarify` | 実行前の要件質問 |
| `review` | ハルシネーション + プラットフォーム不一致スキャン |
| `trio` | 品質ゲート付き並列実行 |
| `plan` | スコープ分析 + チーム推薦 |
| `delegate` | 確認なしの自律実行 |
| `deliver` | 完了まで繰り返し実行 |
| `blitz` | 最大並列バースト |
| `doctor` | デプロイ設定 vs コード整合性チェック |
| `pipeline-run` | GitHub Issue一括自動処理 |
| `superthinking` | 1000回反復思考シミュレーション |
| `waterfall` | ゲート付き順次ステージ処理 |

他10スキル: agents, changelog, docs, health, install, meetings, onboard, sessions, status, update.

## ハーネスコントロール

```
./scope src/auth/       ディレクトリロック
./unlock                ロック解除
./strict                rm -rf ブロック、読み取り強制
./relax                 ストリクト解除
./tdd add user auth     TDD（テスト駆動開発）フロー
./review                ハルシネーションスキャン
./validate              この機能は作る価値があるか？
./clarify               要件確認
```

## オブザーバビリティ

```bash
bestwork                  # TUIダッシュボード
bestwork sessions         # セッション一覧
bestwork heatmap          # 365日アクティビティグリッド
bestwork loops            # ループ検出
bestwork replay <id>      # セッションリプレイ
```

## 通知

```
./discord <webhook_url>
./slack <webhook_url>
```

## セキュリティ

すべてのデータはローカル。外部送信なし。[SECURITY.md](SECURITY.md)参照。

## ライセンス

[MIT](LICENSE)
