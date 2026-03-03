-- =============================================================================
-- Auto Complete Bookings Migration
-- =============================================================================
-- 予約の自動完了機能
-- - 終了時刻から30分経過した予約を自動的にcompletedに更新
-- - task_execution_logsにタスク名を追加
-- - pg_cronジョブ定義
-- =============================================================================

-- =============================================================================
-- 1. task_execution_logs の task_name CHECK制約を更新
-- =============================================================================
-- 既存の制約を削除して再作成
ALTER TABLE task_execution_logs
DROP CONSTRAINT IF EXISTS task_execution_logs_task_name_check;

ALTER TABLE task_execution_logs
ADD CONSTRAINT task_execution_logs_task_name_check
CHECK (task_name IN ('monthly_point_grant', 'reminder_email', 'thank_you_email', 'auto_complete_bookings'));

-- =============================================================================
-- 2. bookings の status変更用インデックス追加
-- =============================================================================
-- confirmed予約の自動完了チェック用インデックス
CREATE INDEX IF NOT EXISTS idx_bookings_auto_complete
ON bookings(end_time)
WHERE status = 'confirmed';

-- =============================================================================
-- 3. pg_cron ジョブ定義（本番デプロイ時にuncomment）
-- =============================================================================

-- 15分ごとに予約自動完了チェック
-- SELECT cron.schedule(
--     'auto-complete-bookings',
--     '*/15 * * * *',
--     $$
--     SELECT
--         net.http_post(
--             url:=vault.get_secret('edge_function_url') || '/auto-complete-bookings',
--             headers:=jsonb_build_object('Authorization', 'Bearer ' || vault.get_secret('edge_function_anon_key')),
--             body:='{}'::jsonb
--         ) as request_id;
--     $$
-- );
