-- =============================================================================
-- Automation Tasks Migration
-- =============================================================================
-- Phase 6: 自動化タスク
-- task_execution_logs、カラム追加、pg_cronジョブ定義（コメント化）
-- =============================================================================

-- Extensions for pg_cron and HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 1. task_execution_logs テーブル（タスク実行履歴）
-- =============================================================================
CREATE TABLE IF NOT EXISTS task_execution_logs (
    id SERIAL PRIMARY KEY,
    task_name TEXT NOT NULL CHECK (task_name IN ('monthly_point_grant', 'reminder_email', 'thank_you_email')),
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial_success', 'timeout')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    total_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    reference_type TEXT CHECK (reference_type IN ('booking', 'member_plan')),
    reference_id INTEGER,
    details JSONB,
    error_details TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_task_execution_logs_task_name ON task_execution_logs(task_name);
CREATE INDEX IF NOT EXISTS idx_task_execution_logs_status ON task_execution_logs(status);
CREATE INDEX IF NOT EXISTS idx_task_execution_logs_created_at ON task_execution_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_task_execution_logs_reference ON task_execution_logs(reference_type, reference_id) WHERE reference_type IS NOT NULL;

-- =============================================================================
-- 2. bookings テーブルへのカラム追加
-- =============================================================================
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS thank_you_sent_at TIMESTAMPTZ;

-- インデックス（リマインダー・サンキューメール送信対象を効率的に検索）
CREATE INDEX IF NOT EXISTS idx_bookings_reminder_sent_at ON bookings(reminder_sent_at) WHERE reminder_sent_at IS NULL AND status = 'confirmed';
CREATE INDEX IF NOT EXISTS idx_bookings_thank_you_sent_at ON bookings(thank_you_sent_at) WHERE thank_you_sent_at IS NULL AND status = 'completed';

-- =============================================================================
-- 3. meeting_menus テーブルへのカラム追加
-- =============================================================================
ALTER TABLE meeting_menus
    ADD COLUMN IF NOT EXISTS send_thank_you_email BOOLEAN DEFAULT false;

-- =============================================================================
-- 4. pg_cron ジョブ定義（本番デプロイ時にuncomment）
-- =============================================================================

-- Vault シークレット設定手順:
-- 1. Supabase Dashboard > Project Settings > Vault でシークレットを作成
--    - edge_function_url: Edge Function の URL (例: https://<project-ref>.supabase.co/functions/v1)
--    - edge_function_anon_key: プロジェクトの anon key
-- 2. 下記のジョブ定義をuncommentして実行

-- 毎月1日 00:00 UTC にポイント付与
-- SELECT cron.schedule(
--     'monthly-point-grant',
--     '0 0 1 * *',
--     $$
--     SELECT
--         net.http_post(
--             url:=vault.get_secret('edge_function_url') || '/cron-monthly-point-grant',
--             headers:=jsonb_build_object('Authorization', 'Bearer ' || vault.get_secret('edge_function_anon_key')),
--             body:='{}'::jsonb
--         ) as request_id;
--     $$
-- );

-- 15分ごとにリマインダーメールチェック
-- SELECT cron.schedule(
--     'check-reminder-emails',
--     '*/15 * * * *',
--     $$
--     SELECT
--         net.http_post(
--             url:=vault.get_secret('edge_function_url') || '/cron-check-reminder-emails',
--             headers:=jsonb_build_object('Authorization', 'Bearer ' || vault.get_secret('edge_function_anon_key')),
--             body:='{}'::jsonb
--         ) as request_id;
--     $$
-- );

-- 15分ごとにサンキューメールチェック
-- SELECT cron.schedule(
--     'check-thank-you-emails',
--     '*/15 * * * *',
--     $$
--     SELECT
--         net.http_post(
--             url:=vault.get_secret('edge_function_url') || '/cron-check-thank-you-emails',
--             headers:=jsonb_build_object('Authorization', 'Bearer ' || vault.get_secret('edge_function_anon_key')),
--             body:='{}'::jsonb
--         ) as request_id;
--     $$
-- );

-- =============================================================================
-- 5. タスク実行ログ自動クリーンアップジョブ（365日保持）
-- =============================================================================
-- 毎日 02:00 UTC に365日以前のログを削除
-- SELECT cron.schedule(
--     'cleanup-task-execution-logs',
--     '0 2 * * *',
--     $$
--     DELETE FROM task_execution_logs
--     WHERE created_at < NOW() - INTERVAL '365 days';
--     $$
-- );
