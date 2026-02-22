# Phase 6: 自動化タスク - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Edge Functionsによる定期実行タスクの自動化 — 月次ポイント付与、リマインダーメール、サンキューメール。
新機能の追加ではなく、既存の予約・ポイントシステムの自動化処理を実装する。

</domain>

<decisions>
## Implementation Decisions

### タスク実行方式
- Supabase Edge Functions + pg_cronで実行
- MVPはpg_cronのみ、将来的にDatabase Webhooks拡張を見据えた設計
- 月次ポイント付与: 毎月1日 00:00 JST
- リマインダー/サンキューメールチェック: 15分ごと
- Edge Functionsタイムアウト: デフォルト150秒で十分

### 失敗時の挙動
- 即時リトライ3回（指数バックオフなし）
- 管理者通知: 管理画面の実行履歴でのみ確認（メール/Slack通知なし）
- 部分失敗: 成功分は完了扱い、失敗分のみ記録
- ポイント付与失敗: リトライ後も失敗ならスキップ（次月に持ち越さない）
- 手動再実行機能: 不要（次の定期実行を待つ）

### メール送信タイミング
- リマインダーメール: 予約の24時間前に送信
- サンキューメール: セッション終了30分後に送信
- 対象: 会員・ゲスト両方に送信
- サンキューメールON/OFF: meeting_menusテーブルにカラム追加（send_thank_you_email, default: false）

### 実行履歴管理
- 保存先: 新規テーブル（task_execution_logs）
- 表示: ダッシュボードに概要 + /admin/tasks に詳細一覧
- 保持期間: 365日
- 記録粒度: ユーザー単位（「ユーザーAにメール送信」単位で記録）

### Claude's Discretion
- task_execution_logsテーブルの具体的なスキーマ設計
- pg_cronジョブの具体的な設定
- Edge Functions内のエラーハンドリング詳細

</decisions>

<specifics>
## Specific Ideas

- 15分チェック間隔 + 24時間前リマインダー = 最大15分の誤差は許容
- サンキューメールはデフォルトOFF — かずみんが明示的に有効化するメニューのみ送信

</specifics>

<deferred>
## Deferred Ideas

None — 議論はフェーズスコープ内で完結

</deferred>

---

*Phase: 06-automation-tasks*
*Context gathered: 2026-02-23*
