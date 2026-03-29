-- Migration: Seed money block resolution plan and menu
-- Created: 2026-03-27
-- Purpose: お金のブロック解消プランと専用メニューの初期データ投入

WITH new_plan AS (
  INSERT INTO plans (name, monthly_points, max_points, price_monthly, is_active)
  VALUES ('お金のブロック解消プラン', 120, 240, 50000, true)
  RETURNING id
)
INSERT INTO meeting_menus (name, duration_minutes, points_required, zoom_account, description, is_active, allowed_plan_types)
SELECT
  '60分お金のブロック解消セッション',
  60,
  60,
  'A',
  'お金のブロック解消プラン会員向け専用60分セッション',
  true,
  ARRAY[new_plan.id]
FROM new_plan;
