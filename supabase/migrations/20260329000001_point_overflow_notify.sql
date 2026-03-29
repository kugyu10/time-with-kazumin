-- =============================================================================
-- Point Overflow Notify Migration
-- =============================================================================
-- Phase 15: ポイント溢れ通知
-- task_execution_logs の CHECK 制約拡張 + pg_cron ジョブ定義（コメント化）
-- =============================================================================

-- =============================================================================
-- 1. task_execution_logs の CHECK 制約拡張
-- =============================================================================
-- point_overflow_notify タスク名を許容するよう CHECK 制約を拡張する

ALTER TABLE task_execution_logs
  DROP CONSTRAINT IF EXISTS task_execution_logs_task_name_check;

ALTER TABLE task_execution_logs
  ADD CONSTRAINT task_execution_logs_task_name_check
  CHECK (task_name IN (
    'monthly_point_grant',
    'reminder_email',
    'thank_you_email',
    'point_overflow_notify'
  ));

-- =============================================================================
-- 2. pg_cron ジョブ定義（本番デプロイ時に uncomment）
-- =============================================================================

-- Vault シークレット設定手順:
-- 1. Supabase Dashboard > Project Settings > Vault でシークレットを確認
--    - edge_function_url: Edge Function の URL (例: https://<project-ref>.supabase.co/functions/v1)
--    - edge_function_anon_key: プロジェクトの anon key
-- 2. 下記のジョブ定義をuncommentして実行

-- 毎月20日 00:00 UTC (JST 09:00) にポイント溢れ通知
-- SELECT cron.schedule(
--     'point-overflow-notify',
--     '0 0 20 * *',
--     $$
--     SELECT
--         net.http_post(
--             url:=vault.get_secret('edge_function_url') || '/point-overflow-notify',
--             headers:=jsonb_build_object('Authorization', 'Bearer ' || vault.get_secret('edge_function_anon_key')),
--             body:='{}'::jsonb
--         ) as request_id;
--     $$
-- );
