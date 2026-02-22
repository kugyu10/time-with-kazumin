-- =============================================================================
-- Seed Data for Time with Kazumin
-- =============================================================================
-- マスターデータのみ（プラン、メニュー、営業時間）
-- =============================================================================

-- Plans（サブスクプラン）
INSERT INTO plans (name, monthly_points, max_points, price_monthly, is_active) VALUES
('無料プラン', 0, 0, 0, true),
('ベーシックプラン', 400, 800, 5000, true),
('スタンダードプラン', 1000, 2000, 10000, true),
('プレミアムプラン', 2000, 4000, 18000, true)
ON CONFLICT DO NOTHING;

-- Meeting Menus（セッション種別）
INSERT INTO meeting_menus (name, duration_minutes, points_required, zoom_account, description, is_active) VALUES
('カジュアル30分', 30, 0, 'B', 'ゲスト向け無料体験セッション（40分制限）', true),
('ショートセッション', 30, 100, 'A', '会員向け30分セッション', true),
('スタンダードセッション', 60, 200, 'A', '会員向け60分セッション', true),
('ロングセッション', 90, 300, 'A', '会員向け90分セッション', true)
ON CONFLICT DO NOTHING;

-- Weekly Schedules（営業時間デフォルト設定: 月〜金 10:00-18:00）
INSERT INTO weekly_schedules (day_of_week, is_holiday_pattern, start_time, end_time) VALUES
(1, false, '10:00', '18:00'),  -- Monday
(2, false, '10:00', '18:00'),  -- Tuesday
(3, false, '10:00', '18:00'),  -- Wednesday
(4, false, '10:00', '18:00'),  -- Thursday
(5, false, '10:00', '18:00')   -- Friday
ON CONFLICT DO NOTHING;

-- App Settings（初期設定）
INSERT INTO app_settings (key, value) VALUES
('last_calendar_sync', NULL)
ON CONFLICT (key) DO NOTHING;
