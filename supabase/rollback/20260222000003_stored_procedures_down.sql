-- =============================================================================
-- Rollback Migration for Stored Procedures
-- =============================================================================

-- Drop functions
DROP FUNCTION IF EXISTS manual_adjust_points(INTEGER, INTEGER, TEXT);
DROP FUNCTION IF EXISTS grant_monthly_points();
DROP FUNCTION IF EXISTS refund_points(INTEGER, INTEGER, TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS consume_points(INTEGER, INTEGER, TEXT, INTEGER, TEXT);
