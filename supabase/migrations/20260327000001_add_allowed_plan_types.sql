-- Migration: Add allowed_plan_types column to meeting_menus
-- Created: 2026-03-27
-- Purpose: プランタイプ別メニュー表示（Phase 14）の基盤カラム

ALTER TABLE meeting_menus
ADD COLUMN IF NOT EXISTS allowed_plan_types INTEGER[] DEFAULT NULL;

COMMENT ON COLUMN meeting_menus.allowed_plan_types IS 'NULL = 全プランに表示（後方互換）。ARRAY[plan_id, ...] で対象プランを限定する。';

CREATE INDEX IF NOT EXISTS idx_meeting_menus_allowed_plan_types
ON meeting_menus USING gin(allowed_plan_types)
WHERE allowed_plan_types IS NOT NULL;
