# Phase 15: ポイント溢れ通知メール - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

ポイントが翌月付与でmax_pointsを超える予定の会員に対し、毎月20日に自動でリマインダーメールを送信する。Edge Function + pg_cron バッチ。管理画面での実行履歴確認を含む。

</domain>

<decisions>
## Implementation Decisions

### メール文面・トーン
- **D-01:** やさしいリマインダートーン。「ポイントがもったいないです！予約して使ってくださいね」のように友だち感覚で伝える。ブランド方針（パッと気分が明るくなる、あたたかい雰囲気）に準拠。
- **D-02:** メールに予約ページへのCTAリンクを含める。「今すぐ予約する」ボタンで予約画面へ誘導。
- **D-03:** メール本文に以下を記載: 現在ポイント、月次付与ポイント、上限（max_points）、溢れ量（overflow = current + monthly - max）。
- **D-04:** メールテンプレートはReact Emailファイルベース管理（PROJECT.md既定方針）。

### 溢れ判定ロジック
- **D-05:** 単純判定: `current_points + monthly_points > max_points` で判定する。予約済み（将来消費予定）ポイントは考慮しない。
- **D-06:** 溢れ量の計算: `overflow = current_points + monthly_points - max_points`。

### バッチ実行
- **D-07:** Edge Function `point-overflow-notify` を `monthly-point-grant` パターンで実装する（冪等性チェック + task_execution_logs記録 + リトライロジック）。
- **D-08:** pg_cron スケジュール: UTC `0 0 20 * *` = JST 20日09:00（STATE.md既定方針）。
- **D-09:** 冪等性: `task_execution_logs` に当月分の `point_overflow_notify` が既に存在する場合はスキップ。

### 管理画面
- **D-10:** `TaskName` 型に `"point_overflow_notify"` を追加する。既存の `admin/tasks` 画面のフィルタ・UIをそのまま利用。
- **D-11:** task_execution_logs にメール送信件数（success_count）と失敗件数（failed_count）を記録する。

### Claude's Discretion
- React Emailテンプレートの具体的なレイアウト・スタイリング
- Edge Functionのリトライ回数・タイミング
- 溢れ対象会員の取得クエリの具体的な構文（SQLまたはSupabaseクエリ）
- メールの件名の具体的な文言

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Edge Function参考パターン
- `supabase/functions/monthly-point-grant/index.ts` — 冪等性チェック + task_execution_logs記録 + リトライロジックの参考実装
- `supabase/functions/check-reminder-emails/index.ts` — メール送信Edge Functionの参考パターン
- `supabase/functions/check-thank-you-emails/index.ts` — メール送信の別パターン

### DBスキーマ
- `supabase/migrations/20260223000001_automation_tasks.sql` — task_execution_logs テーブル定義
- `supabase/migrations/20260222000001_initial_schema.sql` — member_plans, plans テーブル定義（current_points, monthly_points, max_points）

### メール送信
- `src/lib/integrations/email.ts` — Resendメール送信統合
- 既存React Emailテンプレート（check-reminder-emails, check-thank-you-emailsで使用）

### 管理画面
- `src/lib/actions/admin/tasks.ts` — TaskName型、getTaskLogs Server Action
- `src/app/admin/tasks/columns.tsx` — タスクログ表示カラム定義
- `src/app/admin/tasks/tasks-client.tsx` — タスクログフィルタUI

### 要件
- `.planning/REQUIREMENTS.md` — POINT-01〜POINT-05の要件定義

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `monthly-point-grant/index.ts`: Edge Function + 冪等性 + task_execution_logs パターンをそのまま踏襲
- `task_execution_logs` テーブル: 既に稼働中。status, total_count, success_count, failed_count, details, error_detailsカラムあり
- `getTaskLogs()`: Server Action with filters — TaskName追加で自動対応
- Resend + React Email: メール送信基盤確立済み

### Established Patterns
- Edge Function: `Deno.serve` + `createClient` + 認証ヘッダー検証 + 冪等性チェック + リトライ
- task_execution_logs INSERT: task_name, status, started_at, completed_at, total/success/failed_count, details, error_details
- pg_cron: `supabase/migrations/` にcron設定SQLとして追加

### Integration Points
- `supabase/functions/point-overflow-notify/index.ts`: 新規Edge Function
- `supabase/migrations/` に pg_cron 設定マイグレーション追加
- `src/lib/actions/admin/tasks.ts`: TaskName型拡張
- React Emailテンプレート新規作成

</code_context>

<specifics>
## Specific Ideas

- 既存のmonthly-point-grantは毎月1日実行、point-overflow-notifyは毎月20日実行 — 時期がずれるので競合なし
- メール文面の「溢れ量」は分かりやすく「{overflow}ポイントが使えなくなります」のように具体的に伝える
- 対象会員クエリ: `member_plans` JOIN `plans` WHERE `status = 'active'` AND `current_points + monthly_points > max_points`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-point-overflow-notify*
*Context gathered: 2026-03-29*
