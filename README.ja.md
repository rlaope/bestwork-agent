# bestwork-agent

ただのサークルではなく、会社のように働く。あなたのAIエージェントに、実際のエンジニアリング組織が使う組織図、品質ゲート、チームレビューを与えます。

<p align="center">
  <a href="README.md">English</a> · <a href="README.ko.md">한국어</a> · <a href="README.ja.md">日本語</a>
</p>

---

## 問題

AIエージェントは一人で働きます。ハルシネーション、ループ、要件漏れを生み、問題に気づくのが遅すぎます。AI生成コードの45%に脆弱性が含まれています（Veracode）。バイブコーディングアプリはアイデア検証なしで作られ、失敗します。

**bestwork-agent**は、最高のユニコーン企業がエンジニアリングチームを組織するやり方で、あなたのAIエージェントを組織します — そして、そのチームが頼りにする品質ゲートを重ねることで、本当に信頼できる成果物だけが出荷されるようにします。

## チームは自分で組成される

bestworkはすべてのプロンプトを分析し、コードが書かれる前に適切なチーム形態を選びます。

```
あなた: "authモジュールをOAuth2対応にリファクタ"

bestwork分析 → 大規模、アーキテクチャ決定、セキュリティ敏感
bestwork選択 → Hierarchy: Security Team

┌─────────────────────────────────────────────────────┐
│  CISO                                               │
│  "攻撃面は許容範囲。条件付き承認:                     │
│   デプロイ時に既存JWTシークレットをローテート。"       │
│          ▲ 最終決定                                  │
│  Tech Lead                                          │
│  "OAuth2 PKCEフロー正確。2つのトークンリフレッシュ     │
│   パスを1つに統合してください。"                      │
│          ▲ アーキテクチャレビュー                     │
│  Sr. Security Engineer                              │
│  "実装は安全。CSRF保護追加。                          │
│   redirect_uriの入力検証。"                          │
│          ▲ 実装 + ハードニング                        │
│  Jr. QA Engineer                                    │
│  "発見: /callbackが期限切れstateを処理しない。         │
│   トークンリプレイ攻撃テスト追加。"                   │
│          ▲ 新しい視点 + エッジケース                  │
└─────────────────────────────────────────────────────┘
```

```
あなた: "設定ページにダークモードトグル追加"

bestwork分析 → 単一機能、ローカルスコープ、高速フィードバック
bestwork選択 → Squad: Feature Squad

┌──────────────────────────────────────────────────────┐
│                  Feature Squad (並列)                 │
│                                                       │
│  Sr. Backend         Sr. Frontend       Product Lead  │
│  "ユーザー設定API    "CSS変数で         "ユーザー     │
│   準備完了。テスト    トグルコンポ、     ストーリー   │
│   合格。"             アクセシブル。"    一致。出荷。" │
│                          QA Lead                      │
│                    "ライト/ダーク/                    │
│                     システム設定テスト                 │
│                     全合格。"                          │
│                                                       │
│  結論: 全員APPROVE → マージ                          │
└──────────────────────────────────────────────────────┘
```

```
あなた: "前回のセッション、なぜ苦戦した？"

bestwork分析 → オブザーバビリティ依頼、コーディングではない
bestwork選択 → データ分析

  セッション結果 — b322dc3e  ✗ 苦戦

  Duration:     45m
  Calls/Prompt: 38 (高 — 平均は12)
  ループ検出: Edit → Bash(テスト失敗) → Edit × 6 on auth.ts

  根本原因: importの欠落でテスト失敗ループ
  推奨: ./strict で read-before-edit を強制
```

## チームが形を選ぶ方法

bestworkは、最高のエンジニアリング組織の働き方を反映します。

**Hierarchy** — 権限レイヤーが必要な決定
```
CTO → Tech Lead → Sr. Engineer → Jr. Engineer
```
Juniorが先に実装（新しい視点で明らかな問題を捕捉）、Seniorが洗練、Leadがアーキテクチャをレビュー、C-levelが最終戦略判断。各レベルが下に差し戻し可能。

**Squad** — スピードと協調が必要なタスク
```
Backend + Frontend + Product + QA (全員対等)
```
全員並列。単一の権限なし。コンセンサスベース。高速。

**ゲートウェイがタスクシグナルから自動選択**:
- 簡単な修正 / rename / format → **solo** (エージェント1名、オーバーヘッドなし)
- 関連する2つのサブタスク → **pair** (タスク毎にエージェント1 + クリティック)
- 複数サブタスク → **trio** (タスク毎に tech + PM + critic、並列)
- 大規模 / ディレクトリ横断 / アーキテクチャ → **hierarchy** (CTO → Lead → Senior → Junior)
- 単一機能 / バグ修正 / ローカル → **squad** (フラット、コンセンサスベース)
- セキュリティ敏感ファイル → security team
- インフラ / CI/CDファイル → infra squad

soloでない場合、ゲートウェイがプランを表示し、確認/調整/soloへのダウングレードを求めます。

## チームが頼る品質ゲート

チーム構造だけでは不十分 — AIエージェントは依然としてハルシネーションを起こします。すべてのアクションは、実際のエンジニアリングチームが頼りにする品質ゲートを通過します。

| ゲート | タイミング | キャッチ対象 |
|--------|-----------|-------------|
| **グラウンディング** | PreToolUse (Edit/Write) | 未読ファイルの編集 |
| **スコープロック** | PreToolUse | ロックディレクトリ外の編集 |
| **ストリクト** | PreToolUse | `rm -rf`、`git push --force` |
| **タイプチェック** | PostToolUse (Edit/Write) | 変更後のTypeScriptエラー |
| **レビュー** | オンデマンド / PostToolUse | 偽import、ハルシネーションメソッド、プラットフォーム不一致、非推奨API |
| **要件チェック** | PostToolUse (Edit/Write) | clarify/validateセッションの未達要件 |
| **Verifier** | 作成者パス後 | 別パス完了検証、フレッシュな証拠テーブル |
| **検証** | ビルド前 | エビデンスベースのgo/no-go — この機能は作る価値があるか？ |

すべてのゲートは自動実行されます。プロンプトを入力するだけです。

## 証拠: ハーネスON vs OFF

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

## 50ドメインスペシャリスト

**25 Tech** · **10 PM** · **15 Critic**

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
