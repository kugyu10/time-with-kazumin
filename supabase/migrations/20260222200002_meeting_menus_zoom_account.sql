-- Migration: Add zoom_account column to meeting_menus
-- Created: 2026-02-22
-- Purpose: Support multiple Zoom accounts (A or B) per menu

-- Add zoom_account column to meeting_menus
ALTER TABLE meeting_menus
ADD COLUMN IF NOT EXISTS zoom_account CHAR(1) DEFAULT 'A' CHECK (zoom_account IN ('A', 'B'));

-- Comment for documentation
COMMENT ON COLUMN meeting_menus.zoom_account IS 'Zoom account to use for meetings created from this menu (A or B)';
