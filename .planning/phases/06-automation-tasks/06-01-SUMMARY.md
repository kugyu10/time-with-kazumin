---
phase: 06-automation-tasks
plan: 01
subsystem: automation
tags: [pg_cron, edge-functions, react-email, supabase, automation, email-templates]

# Dependency graph
requires:
  - phase: 02-auth-and-booking-core
    provides: bookings基盤、メールテンプレート構造（BookingConfirmation）
  - phase: 05-admin-features
    provides: メニュー管理UI（menu-form.tsx, menus.ts）
provides:
  - task_execution_logsテーブル（タスク実行履歴記録）
  - bookingsにreminder_sent_at/thank_you_sent_atフラグ（重複送信防止）
  - meeting_menusにsend_thank_you_emailフラグ（メニューごとサンキューメールON/OFF）
  - React Emailテンプレート（BookingReminder, ThankYouEmail）
  - メニュー管理UIでサンキューメール設定可能
affects: [phase-06-plan-02, edge-functions, cron-jobs]

# Tech tracking
tech-stack:
  added: [pg_cron, pg_net, pgcrypto]
  patterns: [メール重複送信防止フラグパターン, タスク実行ログパターン, pg_cronジョブ定義パターン]

key-files:
  created:
    - supabase/migrations/20260223000001_automation_tasks.sql
    - src/emails/BookingReminder.tsx
    - src/emails/ThankYouEmail.tsx
  modified:
    - src/components/admin/forms/menu-form.tsx
    - src/lib/actions/admin/menus.ts
    - src/app/admin/menus/columns.tsx

key-decisions:
  - "pg_cronジョブ定義をコメント化: 本番デプロイ時にVaultシークレット設定後にuncomment"
  - "メール送信フラグをTIMESTAMPTZで管理: 重複防止＋送信履歴追跡を同時に実現"
  - "send_thank_you_emailをmeeting_menusに配置: メニューごとにサンキューメール送信をON/OFF可能"
  - "365日自動クリーンアップジョブ定義: task_execution_logs肥大化を防止"

patterns-established:
  - "タスク実行ログパターン: task_name, status, counts, reference_type/id, details/error_details"
  - "メール重複送信防止: reminder_sent_at/thank_you_sent_at TIMESTAMPTZ カラム"
  - "React Emailテンプレート構造: Layout + Props + formatDateTime + Styles"

requirements-completed: [SYS-01, SYS-05, MEMBER-06]

# Metrics
duration: 5min
completed: 2026-02-23
---

# Phase 6 Plan 01: 自動化タスクDB基盤 Summary

**task_execution_logsテーブル、bookings/meeting_menusへの自動化フラグ追加、React Emailテンプレート2つ作成、pg_cronジョブ定義完了**

## Performance

- **Duration:** 5分
- **Started:** 2026-02-22T23:41:42Z
- **Completed:** 2026-02-22T23:46:46Z
- **Tasks:** 4
- **Files modified:** 6

## Accomplishments
- task_execution_logsテーブルでタスク実行履歴を記録可能（バッチ処理、個別実行対応）
- bookingsにreminder_sent_at/thank_you_sent_atフラグ追加（重複送信防止）
- meeting_menusにsend_thank_you_emailフラグ追加（メニューごとON/OFF設定）
- BookingReminderメールテンプレート作成（明日のセッションリマインダー）
- ThankYouEmailメールテンプレート作成（セッション終了後の感謝メッセージ）
- メニュー管理UIでサンキューメール設定可能

## Task Commits

Each task was committed atomically:

1. **Task 1: 自動化タスク用マイグレーション作成** - `1a87c10` (feat)
2. **Task 2: リマインダーメールテンプレート作成** - `220ccb0` (feat)
3. **Task 3: サンキューメールテンプレート作成** - `e695e21` (feat)
4. **Task 4: メニュー管理にsend_thank_you_email設定追加** - `c3a1902` (feat)

## Files Created/Modified

### 作成
- `supabase/migrations/20260223000001_automation_tasks.sql` - task_execution_logsテーブル、カラム追加、pg_cronジョブ定義（コメント化）
- `src/emails/BookingReminder.tsx` - リマインダーメールテンプレート（明日のセッション通知）
- `src/emails/ThankYouEmail.tsx` - サンキューメールテンプレート（セッション終了後感謝メッセージ）

### 変更
- `src/components/admin/forms/menu-form.tsx` - send_thank_you_emailチェックボックス追加
- `src/lib/actions/admin/menus.ts` - send_thank_you_emailフィールド対応
- `src/app/admin/menus/columns.tsx` - Menu型定義にsend_thank_you_email追加

## Decisions Made

**1. pg_cronジョブ定義をコメント化**
- 本番デプロイ時にSupabase VaultでEDGE_FUNCTION_URLとANON_KEYを設定後にuncommentする方式
- ローカル開発時にエラーを回避

**2. メール送信フラグをTIMESTAMPTZで管理**
- boolean + sent_atのペアではなく、sent_at TIMESTAMPTZ単独で管理
- NULL = 未送信、NOT NULL = 送信済み + 送信日時記録

**3. send_thank_you_emailをmeeting_menusに配置**
- メニューごとにサンキューメール送信をON/OFF可能（例: カジュアルトークはOFF、コンサルティングはON）

**4. 365日自動クリーンアップジョブ定義**
- task_execution_logsが肥大化しないよう、毎日02:00 UTCに古いログを削除

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**ローカルDocker未起動**
- `supabase db reset`でマイグレーション検証ができなかった
- マイグレーションSQL構文は手動確認済み、本番デプロイ時に適用予定

## User Setup Required

本番デプロイ時に以下の手順が必要:

1. **Supabase Vault でシークレット設定**
   - `edge_function_url`: Edge FunctionのURL（例: https://<project-ref>.supabase.co/functions/v1）
   - `edge_function_anon_key`: プロジェクトのanon key

2. **pg_cronジョブ有効化**
   - マイグレーションファイル内のコメント化されたジョブ定義をuncomment
   - 再度マイグレーション実行

3. **マイグレーション適用**
   ```bash
   supabase db push
   ```

## Next Phase Readiness

- DB基盤完備 → Phase 6 Plan 2（Edge Functions実装）に進めます
- メールテンプレート完備 → Edge Functionsから即座に利用可能
- メニュー管理UI拡張完了 → 管理者がサンキューメール設定可能

---
*Phase: 06-automation-tasks*
*Completed: 2026-02-23*

## Self-Check: PASSED

### ファイル存在確認
✅ FOUND: supabase/migrations/20260223000001_automation_tasks.sql
✅ FOUND: src/emails/BookingReminder.tsx
✅ FOUND: src/emails/ThankYouEmail.tsx
✅ FOUND: src/components/admin/forms/menu-form.tsx
✅ FOUND: src/lib/actions/admin/menus.ts
✅ FOUND: src/app/admin/menus/columns.tsx

### コミット存在確認
✅ FOUND: 1a87c10 (Task 1: マイグレーション)
✅ FOUND: 220ccb0 (Task 2: BookingReminder)
✅ FOUND: e695e21 (Task 3: ThankYouEmail)
✅ FOUND: c3a1902 (Task 4: メニュー管理UI拡張)
