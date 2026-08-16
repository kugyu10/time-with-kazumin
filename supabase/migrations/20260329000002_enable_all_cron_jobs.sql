-- =============================================================================
-- Enable All Cron Jobs Migration
-- =============================================================================
-- すべてのcronジョブを有効化
-- 前提: pg_cron, pg_net 拡張が有効であること
--       Vault に edge_function_url, edge_function_anon_key が設定済みであること
-- =============================================================================

-- =============================================================================
-- 1. task_execution_logs の CHECK 制約を全タスク名に対応
-- =============================================================================
ALTER TABLE task_execution_logs
  DROP CONSTRAINT IF EXISTS task_execution_logs_task_name_check;

ALTER TABLE task_execution_logs
  ADD CONSTRAINT task_execution_logs_task_name_check
  CHECK (task_name IN (
    'monthly_point_grant',
    'reminder_email',
    'thank_you_email',
    'auto_complete_bookings',
    'point_overflow_notify'
  ));

-- =============================================================================
-- 2. 既存ジョブを削除（冪等性のため）
-- =============================================================================
DO $$
DECLARE
  job_names TEXT[] := ARRAY[
    'monthly-point-grant',
    'check-reminder-emails',
    'check-thank-you-emails',
    'cleanup-task-execution-logs',
    'auto-complete-bookings',
    'point-overflow-notify'
  ];
  jn TEXT;
BEGIN
  FOREACH jn IN ARRAY job_names LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = jn) THEN
      PERFORM cron.unschedule(jn);
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- 3. 全 cron ジョブを登録
-- =============================================================================

-- 毎月1日 00:00 UTC にポイント付与
SELECT cron.schedule(
    'monthly-point-grant',
    '0 0 1 * *',
    $$
    SELECT
        net.http_post(
            url:=(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'edge_function_url' LIMIT 1) || '/monthly-point-grant',
            headers:=jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'edge_function_anon_key' LIMIT 1)),
            body:='{}'::jsonb
        ) as request_id;
    $$
);

-- 15分ごとにリマインダーメールチェック
SELECT cron.schedule(
    'check-reminder-emails',
    '*/15 * * * *',
    $$
    SELECT
        net.http_post(
            url:=(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'edge_function_url' LIMIT 1) || '/check-reminder-emails',
            headers:=jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'edge_function_anon_key' LIMIT 1)),
            body:='{}'::jsonb
        ) as request_id;
    $$
);

-- 15分ごとにサンキューメールチェック
SELECT cron.schedule(
    'check-thank-you-emails',
    '*/15 * * * *',
    $$
    SELECT
        net.http_post(
            url:=(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'edge_function_url' LIMIT 1) || '/check-thank-you-emails',
            headers:=jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'edge_function_anon_key' LIMIT 1)),
            body:='{}'::jsonb
        ) as request_id;
    $$
);

-- 15分ごとに予約自動完了チェック
SELECT cron.schedule(
    'auto-complete-bookings',
    '*/15 * * * *',
    $$
    SELECT
        net.http_post(
            url:=(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'edge_function_url' LIMIT 1) || '/auto-complete-bookings',
            headers:=jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'edge_function_anon_key' LIMIT 1)),
            body:='{}'::jsonb
        ) as request_id;
    $$
);

-- 毎月20日 00:00 UTC (JST 09:00) にポイント溢れ通知
SELECT cron.schedule(
    'point-overflow-notify',
    '0 0 20 * *',
    $$
    SELECT
        net.http_post(
            url:=(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'edge_function_url' LIMIT 1) || '/point-overflow-notify',
            headers:=jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'edge_function_anon_key' LIMIT 1)),
            body:='{}'::jsonb
        ) as request_id;
    $$
);

-- 毎日 02:00 UTC にタスク実行ログクリーンアップ（365日保持）
SELECT cron.schedule(
    'cleanup-task-execution-logs',
    '0 2 * * *',
    $$
    DELETE FROM task_execution_logs
    WHERE created_at < NOW() - INTERVAL '365 days';
    $$
);
